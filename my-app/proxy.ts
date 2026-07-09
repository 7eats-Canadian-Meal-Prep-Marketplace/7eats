import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";

const isDev = process.env.NODE_ENV === "development";

// ─── Content-Security-Policy ───────────────────────────────────────────────────
// Built per-request so inline scripts (our JSON-LD tags, Next.js's own
// bootstrap scripts) can carry a nonce instead of relying on 'unsafe-inline'.
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Calendly widget CSS + the Google Fonts stylesheet it injects at runtime.
    "style-src 'self' 'unsafe-inline' https://assets.calendly.com https://fonts.googleapis.com",
    // React dev mode uses eval for debugging; production builds do not.
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://assets.calendly.com${isDev ? " 'unsafe-eval'" : ""}`,
    "connect-src 'self' https://api.stripe.com https://api.mapbox.com https://events.mapbox.com https://calendly.com",
    "worker-src 'self' blob:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://calendly.com",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// ─── Cookie names ─────────────────────────────────────────────────────────────
// Better Auth sets the session cookie; we set the onboarding cookie server-side
// via /api/auth/complete-onboarding and re-issue it on every sign-in.
const SESSION_COOKIE = "better-auth.session_token";
const ONBOARDED_COOKIE = "7eats-onboarded";

// ─── Client route classification ──────────────────────────────────────────────

/** Consumer routes anyone can view (no session required). */
const CLIENT_PUBLIC_EXACT = new Set([
  "/app",
  "/app/browse",
  "/app/search",
  "/app/cart",
  "/app/checkout",
]);
const CLIENT_PUBLIC_PREFIXES = ["/app/cooks/", "/app/checkout/", "/app/guest/"];

/** Consumer routes that require a verified client account. */
const CLIENT_PROTECTED_EXACT = new Set(["/app/settings", "/app/saved"]);
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

/** Cookie or session timestamp — avoids re-onboarding when cookie was cleared. */
async function isClientOnboarded(req: NextRequest): Promise<boolean> {
  if (isOnboarded(req)) return true;
  if (!hasSession(req)) return false;
  const session = await getSession(req);
  if (session?.user.role !== "client") return false;
  const completed = session.user.onboardingCompletedAt;
  return completed != null && completed !== "";
}

/** Client onboarding gate — cooks/admins browsing the marketplace are treated as guests. */
async function shouldRedirectToClientOnboarding(req: NextRequest) {
  if (!hasSession(req)) return false;
  if (await isClientOnboarded(req)) return false;
  const session = await getSession(req);
  return session?.user.role === "client";
}

function redirectToClientLogin(req: NextRequest, nextPath?: string) {
  const login = new URL("/app-auth/login", req.url);
  if (nextPath) login.searchParams.set("next", nextPath);
  return NextResponse.redirect(login);
}

function redirectToBusinessLogin(req: NextRequest) {
  return NextResponse.redirect(new URL("/business-auth/login", req.url));
}

type AppSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

function isClientUser(session: AppSession): boolean {
  return session.user.role === "client";
}

function isCookOrAdminUser(session: AppSession): boolean {
  return session.user.role === "cook" || session.user.role === "admin";
}

function isBusinessMarketingRoute(pathname: string): boolean {
  return (
    pathname === "/business/home" ||
    pathname === "/business/application" ||
    pathname.startsWith("/business/application/") ||
    pathname === "/business/application-confirmation"
  );
}

function isBusinessCookSetupRoute(pathname: string): boolean {
  return (
    pathname === "/business-auth/setup/verify-phone" ||
    pathname === "/business-auth/setup/onboarding"
  );
}

/** Cook dashboard and tools — not public marketing pages. */
function isBusinessCookPortalRoute(pathname: string): boolean {
  if (isBusinessMarketingRoute(pathname)) return false;
  if (pathname === "/business") return true;
  return pathname.startsWith("/business/");
}

async function requireCookSession(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !isCookOrAdminUser(session)) {
    return { session: null as null, deny: redirectToBusinessLogin(req) };
  }
  return { session, deny: null as null };
}

async function enforceCookSetupProgress(
  req: NextRequest,
  userId: string,
  pathname: string,
): Promise<NextResponse | null> {
  const state = await getCookState(userId);
  if (!state) {
    return redirectToBusinessLogin(req);
  }

  if (pathname === "/business-auth/setup/verify-phone") {
    if (state.phoneVerified) {
      return NextResponse.redirect(
        new URL("/business-auth/setup/onboarding?step=1", req.url),
      );
    }
    return null;
  }

  if (pathname === "/business-auth/setup/onboarding") {
    if (!state.phoneVerified) {
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
    return null;
  }

  if (state.currentSetupStep < 3) {
    return NextResponse.redirect(
      new URL(
        `/business-auth/setup/onboarding?step=${state.currentSetupStep}`,
        req.url,
      ),
    );
  }

  return null;
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

/**
 * Generates a per-request CSP nonce, forwards it to Server Components via the
 * `x-nonce` request header, and stamps the resulting response with the CSP
 * header before returning it. All routing logic lives in `routeRequest`; this
 * wrapper is the single place the nonce and CSP header are attached so every
 * exit path (redirects and pass-throughs alike) gets them.
 */
export async function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await routeRequest(req, requestHeaders);
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

async function routeRequest(
  req: NextRequest,
  requestHeaders: Headers,
): Promise<NextResponse> {
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

  // ── Legacy listing routes → browse ───────────────────────────────────────
  // Listings were removed in the dishes redesign; bounce any old links.
  if (pathname === "/app/listings" || pathname.startsWith("/app/listings/")) {
    return NextResponse.redirect(new URL("/app/browse", req.url));
  }
  // Messaging is disabled for launch — inbox is not accessible.
  if (pathname === "/app/inbox" || pathname.startsWith("/app/inbox/")) {
    return NextResponse.redirect(new URL("/app/browse", req.url));
  }
  if (
    pathname === "/business/inbox" ||
    pathname.startsWith("/business/inbox/")
  ) {
    return NextResponse.redirect(new URL("/business/dashboard", req.url));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT (CONSUMER) SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Client onboarding ────────────────────────────────────────────────────
  if (pathname.startsWith("/app-auth/onboarding")) {
    if (!hasSession(req)) {
      return redirectToClientLogin(req);
    }
    const session = await getSession(req);
    if (session?.user.role !== "client") {
      return NextResponse.redirect(new URL("/app/browse", req.url));
    }
    // Already completed onboarding — skip it
    if (await isClientOnboarded(req)) {
      return NextResponse.redirect(new URL("/app/browse", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Client auth pages (login, signup) ────────────────────────────────────
  // Signed-in clients are bounced to browse (or their intended destination).
  if (pathname === "/app-auth/login" || pathname === "/app-auth/signup") {
    const session = await getSession(req);
    if (session) {
      const role = session.user.role;
      if (role === "client") {
        if (!(await isClientOnboarded(req))) {
          return NextResponse.redirect(
            new URL("/app-auth/onboarding", req.url),
          );
        }
        const next = req.nextUrl.searchParams.get("next");
        const dest =
          next?.startsWith("/app/") && !next.startsWith("//")
            ? next
            : "/app/browse";
        return NextResponse.redirect(new URL(dest, req.url));
      }
      // Cook/admin: allow access to the client login and signup pages so they
      // can switch to (or create) a separate customer account. Better Auth uses
      // a single session cookie, so signing in as a client overwrites the cook
      // session — effectively logging them out of the cook account.
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Client account page ───────────────────────────────────────────────────
  if (pathname === "/app-auth/account") {
    const session = await getSession(req);
    if (!session) {
      return redirectToClientLogin(req);
    }
    if (session?.user.role !== "client") {
      return NextResponse.redirect(new URL("/app/browse", req.url));
    }
    if (!(await isClientOnboarded(req))) {
      return NextResponse.redirect(new URL("/app-auth/onboarding", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Client public routes ──────────────────────────────────────────────────
  // Publicly browsable, but logged-in clients who haven't completed onboarding
  // are redirected to finish it before they can interact with the app.
  if (isClientPublicRoute(pathname)) {
    if (await shouldRedirectToClientOnboarding(req)) {
      return NextResponse.redirect(new URL("/app-auth/onboarding", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Client protected routes ───────────────────────────────────────────────
  if (isClientProtectedRoute(pathname)) {
    const session = await getSession(req);
    if (!session || !isClientUser(session)) {
      return redirectToClientLogin(req, pathname);
    }
    if (!(await isClientOnboarded(req))) {
      return NextResponse.redirect(new URL("/app-auth/onboarding", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Client app catch-all (/app, /app/* not matched above) ─────────────────
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (await shouldRedirectToClientOnboarding(req)) {
      return NextResponse.redirect(new URL("/app-auth/onboarding", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Client auth catch-all (forgot-password, reset-password, etc.) ─────────
  if (pathname.startsWith("/app-auth/")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS (COOK / ADMIN) SECTION — only /business* and /business-auth*
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    !pathname.startsWith("/business") &&
    !pathname.startsWith("/business-auth")
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Business marketing / application pages ───────────────────────────────
  // Public for guests and clients. Signed-in cooks/admins go to their dashboard.
  if (isBusinessMarketingRoute(pathname)) {
    const session = await getSession(req);
    if (session && isCookOrAdminUser(session)) {
      return NextResponse.redirect(new URL("/business/dashboard", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Application confirmation: requires the submission cookie ─────────────
  if (pathname === "/business/application-confirmation") {
    if (!req.cookies.has("application_submitted")) {
      return NextResponse.redirect(new URL("/business/application", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Business login ────────────────────────────────────────────────────────
  if (pathname === "/business-auth/login") {
    const session = await getSession(req);
    if (session && isCookOrAdminUser(session)) {
      return NextResponse.redirect(new URL("/business/dashboard", req.url));
    }
    // Guests and logged-in clients can sign in as a cook (separate account).
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Public business auth (password recovery, magic-link setup) ────────────
  if (
    pathname === "/business-auth/setup/create-password" ||
    pathname === "/business-auth/setup/expired" ||
    pathname === "/business-auth/setup/saved" ||
    pathname === "/business-auth/forgot-password" ||
    pathname === "/business-auth/reset-password"
  ) {
    if (pathname === "/business-auth/setup/create-password") {
      const existing = await getSession(req);
      if (existing && isCookOrAdminUser(existing)) {
        const state = await getCookState(existing.user.id);
        if (state) {
          if (!state.phoneVerified) {
            return NextResponse.redirect(
              new URL("/business-auth/setup/verify-phone", req.url),
            );
          }
          if (!state.setupComplete) {
            return NextResponse.redirect(
              new URL(
                `/business-auth/setup/onboarding?step=${state.currentSetupStep}`,
                req.url,
              ),
            );
          }
          return NextResponse.redirect(new URL("/business/dashboard", req.url));
        }
      }
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Cook setup + dashboard (cook/admin only) ──────────────────────────────
  // Clients with a marketplace session browse the business site as guests;
  // they must sign in with a cook account to enter the portal or setup flow.
  if (
    isBusinessCookSetupRoute(pathname) ||
    isBusinessCookPortalRoute(pathname)
  ) {
    const { session, deny } = await requireCookSession(req);
    if (deny) return deny;
    if (!session?.user?.id)
      return NextResponse.next({ request: { headers: requestHeaders } });

    const blocked = await enforceCookSetupProgress(
      req,
      session.user.id,
      pathname,
    );
    if (blocked) return blocked;
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Remaining business-auth pages ─────────────────────────────────────────
  if (pathname.startsWith("/business-auth/")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/business/") || pathname === "/business") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
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
// Runs on every page route (not just /app and /business) so the CSP nonce
// reaches every Server Component that renders a JSON-LD <script> tag,
// including marketing/legal pages like /terms and /public/team. Excludes
// API routes and static assets per Next.js's documented CSP-nonce matcher.
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
