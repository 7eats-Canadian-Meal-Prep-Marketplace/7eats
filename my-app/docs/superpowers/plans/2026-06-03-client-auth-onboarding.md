# Client Auth & Onboarding — Full Wiring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the complete client auth flow end-to-end — DB schema, real API calls replacing mocks, route protection, and a shell header that reflects login state with real user data.

**Architecture:** DB adds `onboardingCompletedAt` to `authUser` and a new `userPreferences` table. Three new API routes handle client OTP (Twilio Verify, same service as business) and onboarding completion. The sign-in and sign-out routes set/clear a server-issued httpOnly `7eats-onboarded` cookie that the middleware trusts. The onboarding page reads `phoneVerified` from the Better Auth session to restore step. The shell ProfileMenu replaces hardcoded initials with real session data.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Neon, Better Auth, Twilio Verify, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `db/schema/auth.ts` | Modify | Add `onboardingCompletedAt` to `authUser` |
| `db/schema/preferences.ts` | Create | New `userPreferences` table |
| `db/schema/index.ts` | Modify | Export preferences |
| `lib/auth.ts` | Modify | Add `onboardingCompletedAt` to `additionalFields` |
| `app/api/auth/client/send-otp/route.ts` | Create | Twilio send for clients |
| `app/api/auth/client/verify-otp/route.ts` | Create | Twilio verify for clients, saves phone to DB |
| `app/api/auth/complete-onboarding/route.ts` | Create | Saves prefs, sets cookie, marks complete in DB |
| `app/api/auth/sign-in/route.ts` | Modify | Re-issue `7eats-onboarded` cookie from DB on login |
| `app/api/auth/sign-out/route.ts` | Modify | Clear `7eats-onboarded` cookie on logout |
| `middleware.ts` | Verify | Already reads `7eats-onboarded` — no logic change needed |
| `app/app-auth/onboarding/page.tsx` | Modify | Real API calls, restore step from session |
| `app/app/layout.tsx` | Modify | Pass user name/initials to AppShell |
| `app/app/_shell.tsx` | Modify | ProfileMenu uses real user data |
| `__tests__/client-send-otp.test.ts` | Create | Tests for client send-otp |
| `__tests__/client-verify-otp.test.ts` | Create | Tests for client verify-otp |
| `__tests__/complete-onboarding.test.ts` | Create | Tests for complete-onboarding |
| `__tests__/auth-sign-in.test.ts` | Modify | Add cookie re-issue assertions |

---

## Task 1: DB Schema — `onboardingCompletedAt` + `userPreferences`

**Files:**
- Modify: `db/schema/auth.ts`
- Create: `db/schema/preferences.ts`
- Modify: `db/schema/index.ts`

- [ ] **Step 1: Add `onboardingCompletedAt` to `authUser`**

In `db/schema/auth.ts`, add one column inside the `authUser` table definition after `stripeCustomerId`:

```ts
onboardingCompletedAt: timestamp("onboarding_completed_at"),
```

- [ ] **Step 2: Create `db/schema/preferences.ts`**

```ts
import { sql } from "drizzle-orm";
import { json, pgPolicy, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => authUser.id, { onDelete: "cascade" }),
    dietary: json("dietary").$type<string[]>().notNull(),
    allergies: json("allergies").$type<string[]>().notNull(),
    goals: json("goals").$type<string[]>().notNull(),
    whyMealPrep: text("why_meal_prep"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    pgPolicy("user_prefs_own", {
      for: "all",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
      withCheck: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("user_prefs_admin", {
      for: "all",
      to: "public",
      using: sql`auth.role() = 'admin'`,
    }),
  ],
).enableRLS();
```

- [ ] **Step 3: Export from `db/schema/index.ts`**

Add this line in alphabetical order:

```ts
export * from "./preferences";
```

- [ ] **Step 4: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: new migration file in `db/migrations/`, no errors.

- [ ] **Step 5: Commit**

```bash
git add db/schema/auth.ts db/schema/preferences.ts db/schema/index.ts db/migrations/
git commit -m "feat(db): add onboardingCompletedAt to authUser, add userPreferences table"
```

---

## Task 2: Update `lib/auth.ts` — Add `onboardingCompletedAt` to additionalFields

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add the field**

In `lib/auth.ts`, inside `user.additionalFields`, add after `phoneVerified`:

```ts
onboardingCompletedAt: {
  type: "string", // Better Auth serialises Date as ISO string
  required: false,
},
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
pnpm dev
```

Expected: no TypeScript errors in `lib/auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): expose onboardingCompletedAt in session additionalFields"
```

---

## Task 3: `POST /api/auth/client/send-otp` + Tests

**Files:**
- Create: `app/api/auth/client/send-otp/route.ts`
- Create: `__tests__/client-send-otp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/client-send-otp.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verificationsCreate } = vi.hoisted(() => ({
  verificationsCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/cookie", () => ({
  generateSignedPhone: vi.fn(() => "signed-phone"),
}));
vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn(),
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    verify: {
      v2: {
        services: vi.fn(() => ({
          verifications: { create: verificationsCreate },
        })),
      },
    },
  })),
}));

import { POST } from "@/app/api/auth/client/send-otp/route";
import { auth } from "@/lib/auth";
import { generateSignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/client/send-otp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId } } as never) : null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "token_test");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_test");
  vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/client/send-otp", () => {
  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest({ phone: "4165550123" }));
    expect(res.status).toBe(401);
    expect(verificationsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid phone number", async () => {
    mockSession("user-1");
    const res = await POST(makeRequest({ phone: "123" }));
    expect(res.status).toBe(400);
    expect(logAndCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockSession("user-1");
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);
    const res = await POST(makeRequest({ phone: "4165550123" }));
    expect(res.status).toBe(429);
    expect(verificationsCreate).not.toHaveBeenCalled();
  });

  it("returns 500 when Twilio fails", async () => {
    mockSession("user-1");
    verificationsCreate.mockRejectedValue(new Error("twilio down"));
    const res = await POST(makeRequest({ phone: "4165550123" }));
    expect(res.status).toBe(500);
  });

  it("normalises to E.164, sends code, sets pending_phone cookie", async () => {
    mockSession("user-1");
    verificationsCreate.mockResolvedValue({ status: "pending" });

    const res = await POST(makeRequest({ phone: "(416) 555-0123" }));

    expect(res.status).toBe(200);
    expect(verificationsCreate).toHaveBeenCalledWith({
      to: "+14165550123",
      channel: "sms",
    });
    expect(generateSignedPhone).toHaveBeenCalledWith("+14165550123");
    expect(res.headers.get("set-cookie")).toContain("pending_phone=");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:run __tests__/client-send-otp.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/auth/client/send-otp/route.ts
import { NextResponse } from "next/server";
import twilio from "twilio";
import { auth } from "@/lib/auth";
import { generateSignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function client() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not set");
  return twilio(sid, token);
}

function serviceSid() {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID not set");
  return sid;
}

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { phone } = await req.json();
  const e164 = toE164(phone ?? "");
  if (!e164) {
    return NextResponse.json(
      { error: "Enter a valid North American phone number." },
      { status: 400 },
    );
  }

  const allowed = await logAndCheckRateLimit(`client-otp:${session.user.id}`, {
    windowMinutes: 10,
    maxAttempts: 3,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 10 minutes." },
      { status: 429 },
    );
  }

  try {
    await client().verify.v2.services(serviceSid()).verifications.create({
      to: e164,
      channel: "sms",
    });
  } catch (err) {
    console.error("[client/send-otp]", err);
    return NextResponse.json(
      { error: "Could not send code. Please try again." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("pending_phone", generateSignedPhone(e164), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
pnpm test:run __tests__/client-send-otp.test.ts
```

Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/client/send-otp/route.ts __tests__/client-send-otp.test.ts
git commit -m "feat(api): POST /api/auth/client/send-otp with Twilio Verify"
```

---

## Task 4: `POST /api/auth/client/verify-otp` + Tests

**Files:**
- Create: `app/api/auth/client/verify-otp/route.ts`
- Create: `__tests__/client-verify-otp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/client-verify-otp.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verificationChecksCreate } = vi.hoisted(() => ({
  verificationChecksCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { update: vi.fn() } }));
vi.mock("@/db/schema", () => ({ authUser: { id: "id" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/cookie", () => ({ verifySignedPhone: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    verify: {
      v2: {
        services: vi.fn(() => ({
          verificationChecks: { create: verificationChecksCreate },
        })),
      },
    },
  })),
}));

import { cookies } from "next/headers";
import { POST } from "@/app/api/auth/client/verify-otp/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { verifySignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const USER_ID = "user-uuid";

function mockSession(id: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    id ? ({ user: { id } } as never) : null,
  );
}

function mockCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn(() => (value ? { value } : undefined)),
  } as never);
}

function mockUpdate() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/client/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "token_test");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_test");
  vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/client/verify-otp", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when code is missing", async () => {
    mockSession(USER_ID);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate-limited", async () => {
    mockSession(USER_ID);
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when pending_phone cookie is absent", async () => {
    mockSession(USER_ID);
    mockCookie(undefined);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when cookie signature is invalid", async () => {
    mockSession(USER_ID);
    mockCookie("tampered");
    vi.mocked(verifySignedPhone).mockReturnValue(null);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when Twilio does not approve the code", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockResolvedValue({ status: "pending" });
    const res = await POST(makeRequest({ code: "000000" }));
    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 500 when Twilio throws", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockRejectedValue(new Error("twilio down"));
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(500);
  });

  it("saves phone+phoneVerified, clears cookie, returns success on approved code", async () => {
    mockSession(USER_ID);
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockResolvedValue({ status: "approved" });
    const { set } = mockUpdate();

    const res = await POST(makeRequest({ code: "123456" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+14165550123", phoneVerified: true }),
    );
    // pending_phone cookie should be cleared
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("pending_phone=;");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:run __tests__/client-verify-otp.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/auth/client/verify-otp/route.ts
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { verifySignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function client() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not set");
  return twilio(sid, token);
}

function serviceSid() {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID not set");
  return sid;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const allowed = await logAndCheckRateLimit(
    `client-verify-otp:${session.user.id}`,
    { windowMinutes: 10, maxAttempts: 5 },
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }

  const jar = await cookies();
  const signed = jar.get("pending_phone")?.value;
  if (!signed) {
    return NextResponse.json(
      { error: "Session expired. Request a new code." },
      { status: 400 },
    );
  }

  const phone = verifySignedPhone(signed);
  if (!phone) {
    return NextResponse.json(
      { error: "Session expired. Request a new code." },
      { status: 400 },
    );
  }

  let status: string;
  try {
    const check = await client()
      .verify.v2.services(serviceSid())
      .verificationChecks.create({ to: phone, code });
    status = check.status;
  } catch (err) {
    console.error("[client/verify-otp]", err);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 },
    );
  }

  if (status !== "approved") {
    return NextResponse.json(
      { error: "Incorrect code. Try again." },
      { status: 400 },
    );
  }

  await db
    .update(authUser)
    .set({ phone, phoneVerified: true })
    .where(eq(authUser.id, session.user.id));

  const res = NextResponse.json({ success: true });
  res.cookies.delete("pending_phone");
  return res;
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
pnpm test:run __tests__/client-verify-otp.test.ts
```

Expected: all 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/client/verify-otp/route.ts __tests__/client-verify-otp.test.ts
git commit -m "feat(api): POST /api/auth/client/verify-otp with Twilio Verify"
```

---

## Task 5: `POST /api/auth/complete-onboarding` + Tests

**Files:**
- Create: `app/api/auth/complete-onboarding/route.ts`
- Create: `__tests__/complete-onboarding.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/complete-onboarding.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { update: vi.fn(), insert: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  authUser: { id: "id" },
  userPreferences: { userId: "user_id" },
}));
vi.mock("drizzle-orm/pg-core", () => ({ onConflictDoUpdate: vi.fn() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { POST } from "@/app/api/auth/complete-onboarding/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const USER_ID = "user-123";
const VALID_BODY = {
  dietary: ["Halal", "Vegan"],
  allergies: ["Peanuts"],
  goals: ["High protein"],
  whyMealPrep: "Save time cooking",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/complete-onboarding", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(id: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    id ? ({ user: { id } } as never) : null,
  );
}

function mockDbChain() {
  // insert...values...onConflictDoUpdate chain
  const onConflict = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate: onConflict }));
  vi.mocked(db.insert).mockReturnValue({ values } as never);

  // update...set...where chain
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);

  return { set, onConflict };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/complete-onboarding", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid (arrays required)", async () => {
    mockSession(USER_ID);
    const res = await POST(makeRequest({ dietary: "not-an-array" }));
    expect(res.status).toBe(400);
  });

  it("upserts preferences and marks onboarding complete", async () => {
    mockSession(USER_ID);
    const { set, onConflict } = mockDbChain();

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Prefs upserted
    expect(onConflict).toHaveBeenCalled();

    // authUser.onboardingCompletedAt updated
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingCompletedAt: expect.any(Date) }),
    );
  });

  it("sets an httpOnly 7eats-onboarded cookie on success", async () => {
    mockSession(USER_ID);
    mockDbChain();

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("7eats-onboarded=1");
    expect(cookie).toContain("HttpOnly");
  });

  it("accepts empty arrays (all prefs optional)", async () => {
    mockSession(USER_ID);
    mockDbChain();

    const res = await POST(
      makeRequest({ dietary: [], allergies: [], goals: [], whyMealPrep: "" }),
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:run __tests__/complete-onboarding.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/auth/complete-onboarding/route.ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";

const schema = z.object({
  dietary: z.array(z.string()),
  allergies: z.array(z.string()),
  goals: z.array(z.string()),
  whyMealPrep: z.string().optional().default(""),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid preferences." },
      { status: 400 },
    );
  }

  const { dietary, allergies, goals, whyMealPrep } = parsed.data;
  const userId = session.user.id;

  // Upsert preferences
  await db
    .insert(userPreferences)
    .values({ userId, dietary, allergies, goals, whyMealPrep })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { dietary, allergies, goals, whyMealPrep, updatedAt: new Date() },
    });

  // Mark onboarding complete
  await db
    .update(authUser)
    .set({ onboardingCompletedAt: new Date() })
    .where(eq(authUser.id, userId));

  const res = NextResponse.json({ success: true });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `7eats-onboarded=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  );
  return res;
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
pnpm test:run __tests__/complete-onboarding.test.ts
```

Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/complete-onboarding/route.ts __tests__/complete-onboarding.test.ts
git commit -m "feat(api): POST /api/auth/complete-onboarding — saves prefs and issues httpOnly cookie"
```

---

## Task 6: Update Sign-In + Sign-Out to Manage `7eats-onboarded` Cookie

**Files:**
- Modify: `app/api/auth/sign-in/route.ts`
- Modify: `app/api/auth/sign-out/route.ts`
- Modify: `__tests__/auth-sign-in.test.ts`

- [ ] **Step 1: Read the sign-out route**

Check `app/api/auth/sign-out/route.ts` to understand current structure.

- [ ] **Step 2: Update `sign-in/route.ts` to re-issue cookie**

After the `authRes.ok` block (line ~92), add a DB lookup and conditionally set the cookie. Replace the section that builds `res`:

```ts
// After: const redirect = isCookOrAdmin ? "/business/dashboard" : "/app/browse";

// Re-issue onboarding cookie from DB so it survives new devices / cleared browsers.
let onboardingDone = false;
if (isClient) {
  const [row] = await db
    .select({ onboardingCompletedAt: authUser.onboardingCompletedAt })
    .from(authUser)
    .where(eq(authUser.email, normalizedEmail))
    .limit(1);
  onboardingDone = row?.onboardingCompletedAt != null;
}

const res = NextResponse.json({ redirect });
for (const cookie of (
  authRes.headers as Headers & { getSetCookie?(): string[] }
).getSetCookie?.() ?? []) {
  res.headers.append("Set-Cookie", cookie);
}
if (onboardingDone) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `7eats-onboarded=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  );
}
return res;
```

Also add `onboardingCompletedAt: authUser.onboardingCompletedAt` to the initial account select (line ~41) so we have the field available:

```ts
const [account] = await db
  .select({
    role: authUser.role,
    emailVerified: authUser.emailVerified,
    onboardingCompletedAt: authUser.onboardingCompletedAt,
  })
  .from(authUser)
  .where(eq(authUser.email, normalizedEmail))
  .limit(1);
```

Then replace the second DB lookup with `account?.onboardingCompletedAt != null`.

- [ ] **Step 3: Update `sign-out/route.ts` to clear cookie**

Read the file first, then add before `return res`:

```ts
res.cookies.set("7eats-onboarded", "", {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 0,
  path: "/",
});
```

- [ ] **Step 4: Update `auth-sign-in.test.ts` — add cookie assertion**

In the existing test file, in the mock for `db.select`, update `setAccount` to include `onboardingCompletedAt`:

```ts
function setAccount(
  account: { role: string; emailVerified: boolean; onboardingCompletedAt?: Date | null } | null,
) {
  const limit = vi.fn().mockResolvedValue(account ? [account] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}
```

Add two new tests at the end of the describe block:

```ts
it("sets 7eats-onboarded cookie when client has completed onboarding", async () => {
  setAccount({
    role: "client",
    emailVerified: true,
    onboardingCompletedAt: new Date(),
  });
  const res = await POST(makeRequest({ ...creds, audience: "client" }));
  expect(res.status).toBe(200);
  const cookies = res.headers.get("set-cookie") ?? "";
  expect(cookies).toContain("7eats-onboarded=1");
});

it("does not set 7eats-onboarded cookie when onboarding is not complete", async () => {
  setAccount({
    role: "client",
    emailVerified: true,
    onboardingCompletedAt: null,
  });
  const res = await POST(makeRequest({ ...creds, audience: "client" }));
  expect(res.status).toBe(200);
  const cookies = res.headers.get("set-cookie") ?? "";
  expect(cookies).not.toContain("7eats-onboarded=1");
});
```

- [ ] **Step 5: Run sign-in tests**

```bash
pnpm test:run __tests__/auth-sign-in.test.ts
```

Expected: all tests PASS including 2 new ones.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/sign-in/route.ts app/api/auth/sign-out/route.ts __tests__/auth-sign-in.test.ts
git commit -m "feat(auth): re-issue 7eats-onboarded cookie on sign-in, clear on sign-out"
```

---

## Task 7: Wire Onboarding Page to Real APIs

**Files:**
- Modify: `app/app-auth/onboarding/page.tsx`

- [ ] **Step 1: Update PhoneStep to call real APIs**

Replace the mock `handleSend` and `handleVerify` in `PhoneStep` with real fetch calls:

```ts
// In PhoneStep component — replace handleSend:
async function handleSend() {
  setSending(true);
  try {
    const res = await fetch("/api/auth/client/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSendError(data.error ?? "Could not send code.");
      return;
    }
    setPhase("code_sent");
    setCode("");
    setCodeError("");
  } catch {
    setSendError("Network error. Please try again.");
  } finally {
    setSending(false);
  }
}

// Replace handleVerify:
async function handleVerify() {
  setVerifying(true);
  try {
    const res = await fetch("/api/auth/client/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCodeError(data.error ?? "Incorrect code.");
      return;
    }
    setPhase("verified");
  } catch {
    setCodeError("Network error. Please try again.");
  } finally {
    setVerifying(false);
  }
}
```

Add `const [sending, setSending] = useState(false)` and `const [verifying, setVerifying] = useState(false)` and `const [sendError, setSendError] = useState("")` to `PhoneStep` state. Update button disabled states and show `sendError` below the phone row.

- [ ] **Step 2: Update PrefsStep to call complete-onboarding**

Replace `onComplete` in `PrefsStep` with a function that calls the API before navigating:

```ts
// In PrefsStep, add isPending state and replace the submit handler:
const [isPending, setIsPending] = useState(false);
const [submitError, setSubmitError] = useState("");

async function handleSubmit(prefs: Prefs) {
  setIsPending(true);
  try {
    const res = await fetch("/api/auth/complete-onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(prefs),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitError(data.error ?? "Something went wrong.");
      return;
    }
    onComplete(prefs);
  } catch {
    setSubmitError("Network error. Please try again.");
  } finally {
    setIsPending(false);
  }
}
```

Pass `handleSubmit` to the submit/skip buttons. Show `submitError` above buttons.

- [ ] **Step 3: Restore step from session instead of localStorage**

In the main `OnboardingPage` `useEffect`, fetch the session to get `phoneVerified`:

```ts
useEffect(() => {
  fetch("/api/auth/get-session")
    .then((r) => r.json())
    .then((data) => {
      const phoneVerified = data?.user?.phoneVerified ?? false;
      setStep(phoneVerified ? 2 : 1);
    })
    .catch(() => setStep(1));
}, []);
```

Remove the `localStorage` read/write for step restoration (localStorage calls in `handlePhoneComplete` and `handlePrefsComplete` can be removed entirely). Keep `setOnboardedCookie()` removal since the server now sets it.

Remove the `setOnboardedCookie` function and its call — the `complete-onboarding` API sets the httpOnly cookie server-side.

- [ ] **Step 4: Verify dev flow manually**

1. Start dev server: `pnpm dev`
2. Sign up new account, verify email
3. Confirm onboarding page loads at step 1
4. Enter phone, send code (check terminal for Twilio log in dev)
5. Enter code, verify
6. Confirm step 2 loads
7. Submit prefs
8. Confirm redirect to `/app/browse`

- [ ] **Step 5: Commit**

```bash
git add app/app-auth/onboarding/page.tsx
git commit -m "feat(onboarding): wire PhoneStep and PrefsStep to real API endpoints"
```

---

## Task 8: Shell — Real User Data in ProfileMenu

**Files:**
- Modify: `app/app/layout.tsx`
- Modify: `app/app/_shell.tsx`

- [ ] **Step 1: Update `app/app/layout.tsx` to extract user data**

Replace the current session handling block:

```ts
// Replace the try block:
let isLoggedIn = false;
let userInitials = "";
let userName = "";
let userEmail = "";

try {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role === "client") {
    isLoggedIn = true;
    const first = session.user.firstName as string | undefined;
    const last = session.user.lastName as string | undefined;
    userName = [first, last].filter(Boolean).join(" ") || session.user.name || "";
    userInitials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
    userEmail = session.user.email;
  }
} catch {
  // unauthenticated — browse is public
}

return (
  <AppShell
    isLoggedIn={isLoggedIn}
    userInitials={userInitials}
    userName={userName}
    userEmail={userEmail}
  >
    {children}
  </AppShell>
);
```

- [ ] **Step 2: Update `AppShell` and `ShellInner` props**

In `_shell.tsx`, update the `AppShell` and `ShellInner` type signatures:

```ts
// Add to both AppShell and ShellInner props:
userInitials?: string;
userName?: string;
userEmail?: string;
```

Pass these through from `AppShell` → `AppProvider` (as additional context fields, or just thread through) → `ShellInner` → `ProfileMenu`.

The cleanest approach: pass `userInitials`, `userName`, `userEmail` directly into `ShellInner`, which passes them to `ProfileMenu`.

- [ ] **Step 3: Update `ProfileMenu` to accept and use real data**

```ts
function ProfileMenu({
  initials,
  name,
  email,
}: {
  initials: string;
  name: string;
  email: string;
}) {
  // ... existing state/effects unchanged ...

  return (
    <div className={styles.profileWrap} ref={ref}>
      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <div className={styles.menuAvatar}>{initials}</div>
            <div className={styles.menuIdentity}>
              <span className={styles.menuName}>{name || "Your account"}</span>
              <span className={styles.menuEmail}>{email}</span>
            </div>
          </div>
          {/* rest unchanged */}
```

Update the call site in `ShellInner`:

```ts
{isLoggedIn ? (
  <ProfileMenu initials={userInitials} name={userName} email={userEmail} />
) : (
  <div className={styles.guestActions}>
    <Link href="/app-auth/login" className={styles.loginBtn}>Log in</Link>
    <Link href="/app-auth/signup" className={styles.signupBtn}>Sign up</Link>
  </div>
)}
```

- [ ] **Step 4: Verify in browser**

1. Log in as a client who has completed onboarding
2. Confirm header shows initials avatar (not "JD")
3. Click avatar — confirm real name and email in dropdown
4. Log out — confirm header reverts to Log in / Sign up links

- [ ] **Step 5: Commit**

```bash
git add app/app/layout.tsx app/app/_shell.tsx
git commit -m "feat(shell): show real user initials and name in ProfileMenu"
```

---

## Task 9: Edge Case Audit

**Files:**
- Verify: `middleware.ts`
- Verify: `app/api/auth/sign-in/route.ts`

- [ ] **Step 1: Verify middleware handles all cases**

Run through these scenarios manually or with curl:

| Scenario | Expected |
|---|---|
| Unauthenticated → `/app/cart` | Redirect `/app-auth/login?next=/app/cart` |
| Unauthenticated → `/app/browse` | Pass through (public) |
| Authenticated, not onboarded → `/app/browse` | Redirect `/app-auth/onboarding` |
| Authenticated, onboarded → `/app/browse` | Pass through |
| Unauthenticated → `/app-auth/onboarding` | Redirect `/app-auth/login` |
| Authenticated → `/app-auth/onboarding` | Pass through |

- [ ] **Step 2: Verify login page hides when logged in**

Navigate to `/app-auth/login` while logged in. The page renders fine (no redirect — intentional, user may be switching accounts). The shell header is not shown on auth pages (no AppShell wrapping them). This is correct.

- [ ] **Step 3: Verify `?next` redirect works in LoginForm**

In `app/components/LoginForm/index.tsx`, confirm this code exists and handles `next` correctly (it does — `safeNext` checks `/app/` prefix):

```ts
const next = searchParams.get("next");
const safeNext =
  next?.startsWith("/app/") && !next.startsWith("//") ? next : null;
const destination = safeNext ?? data.redirect ?? fallback;
```

- [ ] **Step 4: Commit (documentation only)**

```bash
git commit --allow-empty -m "chore: verify edge case routing — all scenarios confirmed"
```

---

## Task 10: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
pnpm test:run
```

Expected: all existing tests pass, 3 new test files pass.

- [ ] **Step 2: Fix any regressions**

If `auth-sign-in.test.ts` breaks due to the `onboardingCompletedAt` field addition, update the `setAccount` mock in that file to include the new field with a default of `null`.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(client-auth): full onboarding flow — DB, APIs, middleware, shell wired end-to-end"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| DB schema: `onboardingCompletedAt` | Task 1 |
| DB schema: `userPreferences` | Task 1 |
| Better Auth additionalFields | Task 2 |
| `client/send-otp` API | Task 3 |
| `client/verify-otp` API | Task 4 |
| `complete-onboarding` API | Task 5 |
| Sign-in re-issues cookie (cross-device) | Task 6 |
| Sign-out clears cookie | Task 6 |
| Onboarding page uses real APIs | Task 7 |
| Step restored from session (`phoneVerified`) | Task 7 |
| Shell shows real initials/name | Task 8 |
| Profile dropdown hidden when logged out | Task 8 |
| Middleware route protection | Task 9 |
| `?next` redirect after login | Task 9 |
| Unit tests for all new routes | Tasks 3–6 |
