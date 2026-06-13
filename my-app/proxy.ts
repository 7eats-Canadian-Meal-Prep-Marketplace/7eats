import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";

// ─── Cookie names ─────────────────────────────────────────────────────────────
// Better Auth sets the session cookie; we set the onboarding cookie server-side
// via /api/auth/complete-onboarding and re-issue it on every sign-in.
const SESSION_COOKIE = "better-auth.session_token";
const ONBOARDED_COOKIE = "7eats-onboarded";

// ─── Client route classification ──────────────────────────────────────────────

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
  return CLIENT_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isClientProtectedRoute(pathname: string): boolean {
  if (CLIENT_PROTECTED_EXACT.has(pathname)) return true;
  return CLIENT_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasSession(req: NextRequest): boolean {
  return req.cookies.has(SESSION_COOKIE);
}

function isOnboarded(req: NextRequest): boolean {
  return req.cookies.get(ONBOARDED_COOKIE)?.value === "1";
}

function redirectToClientLogin(req: NextRequest, nextPath?: string) {
  const login = new URL("/app-auth/login", req.url);
  if (nextPath) login.searchParams.set("next", nextPath);
  return NextResponse.redirect(login);
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Root redirect ────────────────────────────────────────────────────────
  // Business users go to their dashboard; everyone else goes to the client app.
  if (pathname === "/") {
    const session = await getSession(req);
    if (
      session &&
      (session.user.role === "cook" || session.user.role === "admin")
    ) {
      return NextResponse.redirect(new URL("/business/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/app", req.url));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT (CONSUMER) SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Client onboarding ────────────────────────────────────────────────────
  if (pathname.startsWith("/app-auth/onboarding")) {
    if (!hasSession(req)) {
      return redirectToClientLogin(req);
    }
    // Already completed onboarding — skip it
    if (isOnboarded(req)) {
      return NextResponse.redirect(new URL("/app/browse", req.url));
    }
    return NextResponse.next();
  }

  // ── Client auth pages (login, signup) ────────────────────────────────────
  // Signed-in clients are bounced to browse (or their intended destination).
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
      // Cook/admin can create a separate client account — let them through signup.
      if (pathname === "/app-auth/signup") {
        return NextResponse.next();
      }
      // Cook/admin may need to switch accounts for a protected consumer route.
      const next = req.nextUrl.searchParams.get("next");
      if (next?.startsWith("/app/")) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/app/browse", req.url));
    }
    return NextResponse.next();
  }

  // ── Client account page ───────────────────────────────────────────────────
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

  // ── Client public routes ──────────────────────────────────────────────────
  // Publicly browsable, but logged-in clients who haven't completed onboarding
  // are redirected to finish it before they can interact with the app.
  if (isClientPublicRoute(pathname)) {
    if (hasSession(req) && !isOnboarded(req)) {
      return NextResponse.redirect(new URL("/app-auth/onboarding", req.url));
    }
    return NextResponse.next();
  }

  // ── Client protected routes ───────────────────────────────────────────────
  if (isClientProtectedRoute(pathname)) {
    const session = await getSession(req);
    if (!session || session.user.role !== "client") {
      return redirectToClientLogin(req, pathname);
    }
    if (!isOnboarded(req)) {
      return NextResponse.redirect(new URL("/app-auth/onboarding", req.url));
    }
    return NextResponse.next();
  }

  // ── Client app catch-all (/app, /app/* not matched above) ─────────────────
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (hasSession(req) && !isOnboarded(req)) {
      return NextResponse.redirect(new URL("/app-auth/onboarding", req.url));
    }
    return NextResponse.next();
  }

  // ── Client auth catch-all (forgot-password, reset-password, etc.) ─────────
  if (pathname.startsWith("/app-auth/")) {
    return NextResponse.next();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS (COOK / ADMIN) SECTION — only /business* and /business-auth*
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    !pathname.startsWith("/business") &&
    !pathname.startsWith("/business-auth")
  ) {
    return NextResponse.next();
  }

  // ── Public marketing pages ───────────────────────────────────────────────
  if (
    pathname === "/business/application" ||
    pathname.startsWith("/business/application/") ||
    pathname === "/business/home"
  ) {
    return NextResponse.next();
  }

  // ── Application confirmation: requires the submission cookie ─────────────
  if (pathname === "/business/application-confirmation") {
    if (!req.cookies.has("application_submitted")) {
      return NextResponse.redirect(new URL("/business/application", req.url));
    }
    return NextResponse.next();
  }

  // ── Business login ────────────────────────────────────────────────────────
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

  // Everything below requires a valid session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.redirect(new URL("/business-auth/login", req.url));
  }

  const userId = session.user.id;

  // ── Business setup: verify-phone ─────────────────────────────────────────
  if (pathname === "/business-auth/setup/verify-phone") {
    const state = await getCookState(userId);
    if (state?.phoneVerified) {
      return NextResponse.redirect(
        new URL("/business-auth/setup/onboarding?step=1", req.url),
      );
    }
    return NextResponse.next();
  }

  // ── Business dashboard ────────────────────────────────────────────────────
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

  // ── Business onboarding ───────────────────────────────────────────────────
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

// ─── Session / DB helpers ─────────────────────────────────────────────────────

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

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    "/",
    "/app",
    "/app/:path*",
    "/app-auth/:path*",
    "/business/:path*",
    "/business-auth/:path*",
  ],
};
