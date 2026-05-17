# Waitlist Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready `POST /api/waitlist` endpoint that captures email signups into Neon Postgres, rate-limits all inbound attempts by hashed IP (including duplicates), and returns consistent, safe JSON responses.

**Architecture:** Layered modules with single responsibilities — hash, validate, rate-limit, and persist are each isolated files. The route handler is a thin orchestrator. Two Postgres tables: `waitlist` (one row per unique email) and `rate_limit_log` (one row per inbound attempt, enabling full anti-spam coverage regardless of whether the email is new or duplicate).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, @neondatabase/serverless, Zod, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `my-app/package.json` | Modify | Add deps + test/db scripts |
| `my-app/vitest.config.ts` | Create | Vitest config with `@/` alias |
| `my-app/drizzle.config.ts` | Create | drizzle-kit config pointing at schema |
| `my-app/.env.example` | Create | Documented env var template |
| `my-app/db/schema.ts` | Create | Drizzle table definitions for both tables |
| `my-app/db/index.ts` | Create | Neon + Drizzle client singleton |
| `my-app/lib/hash.ts` | Create | SHA-256 IP hashing, returns hex string |
| `my-app/lib/validation.ts` | Create | Zod schema (strict) + header guards |
| `my-app/lib/rate-limit.ts` | Create | Insert log row + count vs window |
| `my-app/lib/waitlist.ts` | Create | Email upsert with conflict ignore |
| `my-app/app/api/waitlist/route.ts` | Create | Route orchestrator |
| `my-app/__tests__/hash.test.ts` | Create | Unit tests — pure function |
| `my-app/__tests__/validation.test.ts` | Create | Unit tests — Zod schema + guards |
| `my-app/__tests__/rate-limit.test.ts` | Create | Tests with mocked DB |
| `my-app/__tests__/waitlist.test.ts` | Create | Tests with mocked DB |
| `my-app/__tests__/route.test.ts` | Create | Integration tests with mocked libs |

---

### Task 1: Install Dependencies and Configure Vitest

**Files:**
- Modify: `my-app/package.json`
- Create: `my-app/vitest.config.ts`

- [ ] **Step 1: Install runtime dependencies**

Run from `my-app/`:
```bash
pnpm add drizzle-orm @neondatabase/serverless zod
```

- [ ] **Step 2: Install dev dependencies**

```bash
pnpm add -D drizzle-kit vitest
```

- [ ] **Step 3: Add scripts to package.json**

In `my-app/package.json`, replace the `"scripts"` block with:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "biome check",
  "format": "biome format --write",
  "test": "vitest",
  "test:run": "vitest run",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate"
}
```

- [ ] **Step 4: Create vitest.config.ts**

Create `my-app/vitest.config.ts`:
```typescript
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 5: Verify vitest is wired up**

```bash
pnpm test:run
```

Expected: No error. Output is "No test files found" or similar — zero failures.

- [ ] **Step 6: Commit**

```bash
git add my-app/package.json my-app/pnpm-lock.yaml my-app/vitest.config.ts
git commit -m "chore: add drizzle, zod, and vitest"
```

---

### Task 2: Environment Config and Drizzle Config

**Files:**
- Create: `my-app/.env.example`
- Create: `my-app/drizzle.config.ts`

- [ ] **Step 1: Create .env.example**

Create `my-app/.env.example`:
```
# Neon Postgres connection string (required)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Rate limiting — both are optional; defaults shown
RATE_LIMIT_WINDOW_MINUTES=60
RATE_LIMIT_MAX_ATTEMPTS=3
```

- [ ] **Step 2: Create drizzle.config.ts**

Create `my-app/drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Verify .env.local is gitignored**

Open `my-app/.gitignore`. Confirm it contains `.env*.local` or `.env.local`. If not, add:
```
.env.local
```

- [ ] **Step 4: Commit**

```bash
git add my-app/.env.example my-app/drizzle.config.ts my-app/.gitignore
git commit -m "chore: add env example and drizzle config"
```

---

### Task 3: Drizzle Schema and DB Client

**Files:**
- Create: `my-app/db/schema.ts`
- Create: `my-app/db/index.ts`

- [ ] **Step 1: Create db/schema.ts**

Create `my-app/db/schema.ts`:
```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  ipHash: text("ip_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rateLimitLog = pgTable("rate_limit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  ipHash: text("ip_hash").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Create db/index.ts**

Create `my-app/db/index.ts`:
```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL environment variable is not set");

const sql = neon(url);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 3: Commit**

```bash
git add my-app/db/
git commit -m "feat: add drizzle schema and db client"
```

---

### Task 4: IP Hashing Utility (TDD)

**Files:**
- Create: `my-app/__tests__/hash.test.ts`
- Create: `my-app/lib/hash.ts`

- [ ] **Step 1: Write the failing tests**

Create `my-app/__tests__/hash.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { hashIp } from "@/lib/hash";

describe("hashIp", () => {
  it("returns a 64-character lowercase hex string", () => {
    const result = hashIp("192.168.1.1");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("is deterministic — same input always produces same hash", () => {
    expect(hashIp("192.168.1.1")).toBe(hashIp("192.168.1.1"));
  });

  it("produces different hashes for different IPs", () => {
    expect(hashIp("192.168.1.1")).not.toBe(hashIp("10.0.0.1"));
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run __tests__/hash.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/hash'"

- [ ] **Step 3: Implement hash.ts**

Create `my-app/lib/hash.ts`:
```typescript
import { createHash } from "crypto";

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run __tests__/hash.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add my-app/lib/hash.ts my-app/__tests__/hash.test.ts
git commit -m "feat: add SHA-256 IP hashing utility"
```

---

### Task 5: Request Validation (TDD)

**Files:**
- Create: `my-app/__tests__/validation.test.ts`
- Create: `my-app/lib/validation.ts`

- [ ] **Step 1: Write the failing tests**

Create `my-app/__tests__/validation.test.ts`:
```typescript
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { guardRequest, waitlistSchema } from "@/lib/validation";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/waitlist", {
    method: "POST",
    headers,
  });
}

describe("waitlistSchema", () => {
  it("accepts a valid email", () => {
    expect(waitlistSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    expect(waitlistSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a missing email field", () => {
    expect(waitlistSchema.safeParse({}).success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    expect(
      waitlistSchema.safeParse({ email: "user@example.com", role: "cook" }).success
    ).toBe(false);
  });
});

describe("guardRequest", () => {
  it("returns null for a valid request", () => {
    const req = makeRequest({
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    });
    expect(guardRequest(req)).toBeNull();
  });

  it("rejects wrong content-type", () => {
    const req = makeRequest({
      "content-type": "text/plain",
      "user-agent": "Mozilla/5.0",
    });
    expect(guardRequest(req)).toBe("Invalid request.");
  });

  it("rejects a missing user-agent", () => {
    const req = makeRequest({ "content-type": "application/json" });
    expect(guardRequest(req)).toBe("Invalid request.");
  });

  it("rejects curl user-agent", () => {
    const req = makeRequest({
      "content-type": "application/json",
      "user-agent": "curl/7.88.1",
    });
    expect(guardRequest(req)).toBe("Invalid request.");
  });

  it("rejects python-requests user-agent", () => {
    const req = makeRequest({
      "content-type": "application/json",
      "user-agent": "python-requests/2.31.0",
    });
    expect(guardRequest(req)).toBe("Invalid request.");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test:run __tests__/validation.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/validation'"

- [ ] **Step 3: Implement validation.ts**

Create `my-app/lib/validation.ts`:
```typescript
import type { NextRequest } from "next/server";
import { z } from "zod";

export const waitlistSchema = z.object({ email: z.string().email() }).strict();

export type WaitlistInput = z.infer<typeof waitlistSchema>;

const BOT_PATTERNS = /curl|python-requests|scrapy|wget|libwww/i;

export function guardRequest(req: NextRequest): string | null {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return "Invalid request.";
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_PATTERNS.test(userAgent)) {
    return "Invalid request.";
  }

  return null;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test:run __tests__/validation.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add my-app/lib/validation.ts my-app/__tests__/validation.test.ts
git commit -m "feat: add Zod validation schema and request guards"
```

---

### Task 6: Rate Limiting (TDD)

**Files:**
- Create: `my-app/__tests__/rate-limit.test.ts`
- Create: `my-app/lib/rate-limit.ts`

- [ ] **Step 1: Write the failing tests**

Create `my-app/__tests__/rate-limit.test.ts`:
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

import { db } from "@/db";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

describe("logAndCheckRateLimit", () => {
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWhere = vi.fn();
    mockFrom = vi.fn(() => ({ where: mockWhere }));

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
  });

  it("inserts a log row and returns true when under the limit", async () => {
    mockWhere.mockResolvedValue([{ count: 2 }]);

    const result = await logAndCheckRateLimit("abc123");

    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("returns true when count exactly equals max attempts (3)", async () => {
    mockWhere.mockResolvedValue([{ count: 3 }]);

    const result = await logAndCheckRateLimit("abc123");
    expect(result).toBe(true);
  });

  it("returns false when count exceeds max attempts", async () => {
    mockWhere.mockResolvedValue([{ count: 4 }]);

    const result = await logAndCheckRateLimit("abc123");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test:run __tests__/rate-limit.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/rate-limit'"

- [ ] **Step 3: Implement rate-limit.ts**

Create `my-app/lib/rate-limit.ts`:
```typescript
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitLog } from "@/db/schema";

const WINDOW_MINUTES = Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? "60");
const MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_MAX_ATTEMPTS ?? "3");

export async function logAndCheckRateLimit(ipHash: string): Promise<boolean> {
  await db.insert(rateLimitLog).values({ ipHash });

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(rateLimitLog)
    .where(
      and(
        eq(rateLimitLog.ipHash, ipHash),
        gt(rateLimitLog.attemptedAt, windowStart)
      )
    );

  return result[0].count <= MAX_ATTEMPTS;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test:run __tests__/rate-limit.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add my-app/lib/rate-limit.ts my-app/__tests__/rate-limit.test.ts
git commit -m "feat: add Postgres-based rate limiting"
```

---

### Task 7: Waitlist Insert (TDD)

**Files:**
- Create: `my-app/__tests__/waitlist.test.ts`
- Create: `my-app/lib/waitlist.ts`

- [ ] **Step 1: Write the failing tests**

Create `my-app/__tests__/waitlist.test.ts`:
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { insert: vi.fn() },
}));

import { db } from "@/db";
import { addToWaitlist } from "@/lib/waitlist";

describe("addToWaitlist", () => {
  let mockOnConflictDoNothing: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOnConflictDoNothing = vi.fn().mockResolvedValue([]);
    mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);
  });

  it("inserts with the correct email and ipHash", async () => {
    await addToWaitlist("user@example.com", "abc123");

    expect(mockValues).toHaveBeenCalledWith({
      email: "user@example.com",
      ipHash: "abc123",
    });
  });

  it("uses onConflictDoNothing so duplicate emails are silently ignored", async () => {
    await addToWaitlist("user@example.com", "abc123");
    expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test:run __tests__/waitlist.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/waitlist'"

- [ ] **Step 3: Implement waitlist.ts**

Create `my-app/lib/waitlist.ts`:
```typescript
import { db } from "@/db";
import { waitlist } from "@/db/schema";

export async function addToWaitlist(email: string, ipHash: string): Promise<void> {
  await db
    .insert(waitlist)
    .values({ email, ipHash })
    .onConflictDoNothing({ target: waitlist.email });
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test:run __tests__/waitlist.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add my-app/lib/waitlist.ts my-app/__tests__/waitlist.test.ts
git commit -m "feat: add idempotent waitlist insert"
```

---

### Task 8: API Route (TDD)

**Files:**
- Create: `my-app/__tests__/route.test.ts`
- Create: `my-app/app/api/waitlist/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `my-app/__tests__/route.test.ts`:
```typescript
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hash", () => ({ hashIp: vi.fn(() => "hashed-ip") }));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("@/lib/waitlist", () => ({ addToWaitlist: vi.fn() }));

import { logAndCheckRateLimit } from "@/lib/rate-limit";
import { addToWaitlist } from "@/lib/waitlist";
import { POST } from "@/app/api/waitlist/route";

function makeRequest(
  body: unknown,
  overrideHeaders: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost/api/waitlist", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
      ...overrideHeaders,
    },
  });
}

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
    vi.mocked(addToWaitlist).mockResolvedValue(undefined);
  });

  it("returns 200 and calls addToWaitlist for a valid signup", async () => {
    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, message: "You're on the list!" });
    expect(vi.mocked(addToWaitlist)).toHaveBeenCalledWith("user@example.com", "hashed-ip");
  });

  it("returns 200 for a duplicate email (idempotent)", async () => {
    const res = await POST(makeRequest({ email: "existing@example.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body).toEqual({
      success: false,
      message: "Too many attempts. Try again later.",
    });
  });

  it("returns 400 for wrong content-type", async () => {
    const res = await POST(
      makeRequest({ email: "user@example.com" }, { "content-type": "text/plain" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it("returns 400 for a bot user-agent", async () => {
    const res = await POST(
      makeRequest({ email: "user@example.com" }, { "user-agent": "python-requests/2.31.0" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an oversized body", async () => {
    const req = new NextRequest("http://localhost/api/waitlist", {
      method: "POST",
      body: "x".repeat(2000),
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-valid" }));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it("returns 500 and does not leak error details on unexpected error", async () => {
    vi.mocked(logAndCheckRateLimit).mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, message: "Something went wrong." });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test:run __tests__/route.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/waitlist/route'"

- [ ] **Step 3: Create the route**

Create `my-app/app/api/waitlist/route.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";
import { guardRequest, waitlistSchema } from "@/lib/validation";
import { addToWaitlist } from "@/lib/waitlist";

const MAX_BODY_BYTES = 1024;

function ok(message: string): NextResponse {
  return NextResponse.json({ success: true, message }, { status: 200 });
}

function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const guardError = guardRequest(req);
    if (guardError) return fail(guardError, 400);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ipHash = hashIp(ip);

    const allowed = await logAndCheckRateLimit(ipHash);
    if (!allowed) return fail("Too many attempts. Try again later.", 429);

    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return fail("Invalid request.", 400);
    }

    if (rawBody.length > MAX_BODY_BYTES) return fail("Invalid request.", 400);

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("Invalid request.", 400);
    }

    const parsed = waitlistSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid request.", 400);

    await addToWaitlist(parsed.data.email, ipHash);

    return ok("You're on the list!");
  } catch (err) {
    console.error("[waitlist] Unhandled error:", err);
    return fail("Something went wrong.", 500);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test:run __tests__/route.test.ts
```

Expected: PASS — 8 tests

- [ ] **Step 5: Run the full test suite**

```bash
pnpm test:run
```

Expected: PASS — 25 tests across 5 files (3 hash + 9 validation + 3 rate-limit + 2 waitlist + 8 route)

- [ ] **Step 6: Commit**

```bash
git add my-app/app/api/waitlist/ my-app/__tests__/route.test.ts
git commit -m "feat: add POST /api/waitlist route"
```

---

### Task 9: Generate and Apply Migration

**Files:**
- Generate: `my-app/db/migrations/` (auto-generated by drizzle-kit)

Prerequisite: `DATABASE_URL` must be set in `my-app/.env.local` with a valid Neon connection string (get it from the Neon dashboard → your project → Connection string).

- [ ] **Step 1: Create .env.local**

Create `my-app/.env.local` (this file is gitignored):
```
DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
```

- [ ] **Step 2: Generate the migration SQL**

Run from `my-app/`:
```bash
pnpm db:generate
```

Expected: Creates `my-app/db/migrations/0000_<name>.sql`. The file should contain `CREATE TABLE` statements for both `waitlist` and `rate_limit_log`.

- [ ] **Step 3: Add the index for rate_limit_log manually**

Open the generated migration SQL file. After the `CREATE TABLE "rate_limit_log"` statement, add:
```sql
CREATE INDEX IF NOT EXISTS "rate_limit_log_ip_hash_attempted_at_idx"
  ON "rate_limit_log" ("ip_hash", "attempted_at");
```

This index makes the count query in `logAndCheckRateLimit` efficient and supports future pruning of old rows.

- [ ] **Step 4: Apply the migration to Neon**

```bash
pnpm db:migrate
```

Expected: drizzle-kit reports all migrations applied successfully. Verify in the Neon dashboard that both tables are visible.

- [ ] **Step 5: Commit migration files**

```bash
git add my-app/db/migrations/
git commit -m "feat: add initial database migration"
```

---

### Task 10: README API Documentation

**Files:**
- Modify: `my-app/README.md`

- [ ] **Step 1: Add API section to README.md**

Open `my-app/README.md` and append:
```markdown
## Waitlist API

### `POST /api/waitlist`

Registers an email address on the pre-launch waitlist.

**Request**

```http
POST /api/waitlist
Content-Type: application/json

{ "email": "user@example.com" }
```

**Response**

All responses return `{ "success": boolean, "message": string }`.

| Status | `success` | `message` | Cause |
|--------|-----------|-----------|-------|
| 200 | `true` | `"You're on the list!"` | Accepted (new or duplicate — indistinguishable by design) |
| 400 | `false` | `"Invalid request."` | Invalid email, wrong Content-Type, bot User-Agent, or body > 1 KB |
| 429 | `false` | `"Too many attempts. Try again later."` | Rate limit exceeded (default: 3 requests / IP / 60 min) |
| 500 | `false` | `"Something went wrong."` | Unexpected server error — details logged server-side only |

**Notes**
- Submitting the same email twice returns `200` — the endpoint is idempotent.
- IPs are hashed with SHA-256 before storage. Raw IPs are never persisted.
- Rate limiting counts all inbound requests per IP, including duplicate submissions and bot probes.
- Configure `RATE_LIMIT_WINDOW_MINUTES` and `RATE_LIMIT_MAX_ATTEMPTS` in `.env.local` to override defaults.
```

- [ ] **Step 2: Commit**

```bash
git add my-app/README.md
git commit -m "docs: add waitlist API documentation"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `waitlist` table — id, email, ip_hash, created_at | Task 3 |
| `rate_limit_log` table — id, ip_hash, attempted_at | Task 3 |
| Index on `(ip_hash, attempted_at)` | Task 9 |
| Drizzle migration setup | Tasks 3 + 9 |
| `POST /api/waitlist` | Task 8 |
| Zod validation — email required, no extra fields | Task 5 |
| Duplicate email → silent 200 (idempotent) | Tasks 7 + 8 |
| SHA-256 IP hashing, never store raw | Task 4 |
| Rate limit ALL attempts (including duplicates) | Task 6 |
| Rate limit via separate Postgres table | Task 6 |
| Content-Type guard | Task 5 |
| Body size ≤ 1 KB | Task 8 |
| Bot User-Agent filtering | Task 5 |
| Consistent `{ success, message }` envelope | Task 8 |
| No internal error details in responses | Task 8 |
| `DATABASE_URL` env var | Tasks 2 + 3 |
| `RATE_LIMIT_WINDOW_MINUTES` / `RATE_LIMIT_MAX_ATTEMPTS` with defaults | Tasks 2 + 6 |
| `.env.example` | Task 2 |
| README API docs | Task 10 |

**Placeholder scan:** No TBD/TODO present. All steps contain code. ✓

**Type consistency:**

| Symbol | Defined | Used |
|---|---|---|
| `hashIp(ip: string): string` | Task 4 | Task 8 |
| `logAndCheckRateLimit(ipHash: string): Promise<boolean>` | Task 6 | Task 8 |
| `guardRequest(req: NextRequest): string \| null` | Task 5 | Task 8 |
| `waitlistSchema` / `WaitlistInput` | Task 5 | Task 8 |
| `addToWaitlist(email: string, ipHash: string): Promise<void>` | Task 7 | Task 8 |
| `rateLimitLog.ipHash`, `rateLimitLog.attemptedAt` | Task 3 | Task 6 |
| `waitlist.email` | Task 3 | Task 7 |

All consistent. ✓
