import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

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

  // login: public, but bounce to dashboard if already logged in
  if (pathname === "/business-auth/login") {
    const session = await getSession(req);
    if (session) {
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

  // dashboard: require steps 1 & 2 complete (step >= 3); steps 3 & 4 can be deferred
  if (pathname.startsWith("/business/dashboard")) {
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
    if (isNaN(stepNum) || stepNum < 1 || stepNum > current) {
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
  ],
};
