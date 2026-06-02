import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";

/** Consumer routes anyone can view (no session required). */
const CLIENT_PUBLIC_EXACT = new Set([
  "/app/browse",
  "/app/search",
  "/app/cart",
  "/app/checkout",
]);
const CLIENT_PUBLIC_PREFIXES = [
  "/app/listings/",
  "/app/cooks/",
  "/app/checkout/",
];

/** Consumer routes that require a verified client account. */
const CLIENT_PROTECTED_EXACT = new Set([
  "/app/inbox",
  "/app/saved",
  "/app/settings",
]);
const CLIENT_PROTECTED_PREFIXES = ["/app/orders"];

function isClientPublicRoute(pathname: string): boolean {
  if (CLIENT_PUBLIC_EXACT.has(pathname)) return true;
  return CLIENT_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isClientProtectedRoute(pathname: string): boolean {
  if (CLIENT_PROTECTED_EXACT.has(pathname)) return true;
  return CLIENT_PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

function redirectToClientLogin(req: NextRequest, nextPath?: string) {
  const login = new URL("/app-auth/login", req.url);
  if (nextPath) login.searchParams.set("next", nextPath);
  return NextResponse.redirect(login);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Client (consumer) auth routes ─────────────────────────────────────
  // Account requires a session; bounce to the client login if absent.
  if (pathname === "/app-auth/account") {
    const session = await getSession(req);
    if (!session) {
      return redirectToClientLogin(req);
    }
    if (session.user.role !== "client") {
      return NextResponse.redirect(new URL("/app/browse", req.url));
    }
    return NextResponse.next();
  }

  // Client login / signup are public, but a signed-in client shouldn't see them.
  if (pathname === "/app-auth/login" || pathname === "/app-auth/signup") {
    const session = await getSession(req);
    if (session) {
      const role = session.user.role;
      if (role === "client") {
        const next = req.nextUrl.searchParams.get("next");
        const dest =
          next?.startsWith("/app/") && !next.startsWith("//")
            ? next
            : "/app/browse";
        return NextResponse.redirect(new URL(dest, req.url));
      }
      // Cook/admin may need to switch accounts for a protected consumer route.
      const next = req.nextUrl.searchParams.get("next");
      if (pathname === "/app-auth/login" && next?.startsWith("/app/")) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/app/browse", req.url));
    }
    return NextResponse.next();
  }

  // ── Client (consumer) app routes ──────────────────────────────────────
  // Browse, search, listings, and cook profiles are public.
  if (isClientPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Checkout, orders, inbox, etc. require a client session.
  if (isClientProtectedRoute(pathname)) {
    const session = await getSession(req);
    if (!session || session.user.role !== "client") {
      return redirectToClientLogin(req, pathname);
    }
    return NextResponse.next();
  }

  // Public marketing pages — no checks
  if (
    pathname === "/business/application" ||
    pathname.startsWith("/business/application/") ||
    pathname === "/business/home"
  ) {
    return NextResponse.next();
  }

  // application-confirmation: cookie must exist (page verifies the signature)
  if (pathname === "/business/application-confirmation") {
    if (!req.cookies.has("application_submitted")) {
      return NextResponse.redirect(new URL("/business/application", req.url));
    }
    return NextResponse.next();
  }

  // login: public, but bounce to dashboard if already logged in as cook/admin
  if (pathname === "/business-auth/login") {
    const session = await getSession(req);
    if (session) {
      if (session.user.role === "client") {
        return NextResponse.redirect(new URL("/business/home", req.url));
      }
      return NextResponse.redirect(new URL("/business/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Everything below this point requires a valid session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.redirect(new URL("/business-auth/login", req.url));
  }

  const userId = session.user.id;

  // verify-phone: if already verified, advance to onboarding
  if (pathname === "/business-auth/setup/verify-phone") {
    const state = await getCookState(userId);
    if (state?.phoneVerified) {
      return NextResponse.redirect(
        new URL("/business-auth/setup/onboarding?step=1", req.url),
      );
    }
    return NextResponse.next();
  }

  // All /business/* dashboard routes require steps 1 & 2 complete (step >= 3)
  if (pathname.startsWith("/business/")) {
    if (session.user.role === "client") {
      return NextResponse.redirect(new URL("/business-auth/login", req.url));
    }
    const state = await getCookState(userId);
    if (!state) {
      return NextResponse.redirect(new URL("/business-auth/login", req.url));
    }
    if (state.currentSetupStep < 3) {
      return NextResponse.redirect(
        new URL(
          `/business-auth/setup/onboarding?step=${state.currentSetupStep}`,
          req.url,
        ),
      );
    }
    return NextResponse.next();
  }

  // onboarding: enforce phone verification and correct step
  if (pathname === "/business-auth/setup/onboarding") {
    const state = await getCookState(userId);
    if (!state?.phoneVerified) {
      return NextResponse.redirect(
        new URL("/business-auth/setup/verify-phone", req.url),
      );
    }
    if (state.setupComplete) {
      return NextResponse.redirect(new URL("/business/dashboard", req.url));
    }
    const step = req.nextUrl.searchParams.get("step");
    const current = state.currentSetupStep;
    const stepNum = Number(step);
    if (Number.isNaN(stepNum) || stepNum < 1 || stepNum > current) {
      return NextResponse.redirect(
        new URL(`/business-auth/setup/onboarding?step=${current}`, req.url),
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

async function getSession(req: NextRequest) {
  try {
    return await auth.api.getSession({ headers: req.headers });
  } catch {
    return null;
  }
}

async function getCookState(userId: string) {
  const [row] = await db
    .select({
      phoneVerified: authUser.phoneVerified,
      currentSetupStep: cookProfiles.currentSetupStep,
      setupComplete: cookProfiles.setupComplete,
    })
    .from(cookProfiles)
    .innerJoin(authUser, eq(authUser.id, cookProfiles.userId))
    .where(eq(authUser.id, userId))
    .limit(1);
  return row ?? null;
}

export const config = {
  matcher: [
    // All /business/* routes (exceptions handled inside proxy)
    "/business/:path*",
    // Setup routes that need session enforcement
    "/business-auth/login",
    "/business-auth/setup/verify-phone",
    "/business-auth/setup/onboarding",
    // Client (consumer) auth routes
    "/app-auth/account",
    "/app-auth/login",
    "/app-auth/signup",
    // Client (consumer) app
    "/app/browse",
    "/app/search",
    "/app/cooks/:path*",
    "/app/listings/:path*",
    "/app/cart",
    "/app/checkout/:path*",
    "/app/inbox",
    "/app/orders/:path*",
    "/app/saved",
    "/app/settings",
  ],
};
