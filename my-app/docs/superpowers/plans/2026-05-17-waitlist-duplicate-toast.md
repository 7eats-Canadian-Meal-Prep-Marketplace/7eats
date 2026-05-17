# Waitlist Duplicate Check + Toast Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect duplicate waitlist signups and surface all feedback (success, duplicate, error) as Sonner toast notifications styled to the app's design system.

**Architecture:** The DB already uses `onConflictDoNothing` — we change `addToWaitlist` to return a boolean indicating whether a row was actually inserted, the API maps `false` to a 409, and the frontend maps each status code to a distinct toast. Sonner is styled via CSS variable overrides in `globals.css`.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (Neon), Sonner (toast), Vitest (tests), TypeScript strict mode.

---

## File Map

| File | Change |
|------|--------|
| `lib/waitlist.ts` | Return `Promise<boolean>` — `true` = new, `false` = duplicate |
| `app/api/waitlist/route.ts` | Check return value; send 409 for duplicate |
| `app/layout.tsx` | Add `<Toaster position="top-center" />` |
| `app/components/CtaSection.tsx` | Replace status state + button swap with toast calls; add try/catch |
| `app/globals.css` | Add Sonner CSS variable overrides |
| `lib/__tests__/waitlist.test.ts` | Unit test for `addToWaitlist` return value |

---

## Task 1: Install sonner

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install the package**

```bash
pnpm add sonner
```

Expected output: `dependencies: + sonner <version>`

- [ ] **Step 2: Verify it resolves**

```bash
pnpm build 2>&1 | head -5
```

Expected: build starts without module-not-found errors (you can Ctrl-C early).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add sonner for toast notifications"
```

---

## Task 2: Update `lib/waitlist.ts` to return a boolean

**Files:**
- Modify: `lib/waitlist.ts`
- Create: `lib/__tests__/waitlist.test.ts`

The current implementation:
```typescript
// lib/waitlist.ts (before)
export async function addToWaitlist(email: string, ipHash: string): Promise<void> {
  await db
    .insert(waitlist)
    .values({ email, ipHash })
    .onConflictDoNothing({ target: waitlist.email });
}
```

We need `.returning()` on the end — Drizzle returns an array of inserted rows. An empty array means the conflict fired (duplicate). A non-empty array means a new row was inserted.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/waitlist.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("@/db", () => ({
  db: { insert: mockInsert },
}));

vi.mock("@/db/schema", () => ({
  waitlist: { email: "email" },
}));

describe("addToWaitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when a new row is inserted", async () => {
    mockReturning.mockResolvedValue([{ email: "new@example.com" }]);
    const { addToWaitlist } = await import("@/lib/waitlist");
    const result = await addToWaitlist("new@example.com", "hash123");
    expect(result).toBe(true);
  });

  it("returns false when the email already exists (conflict)", async () => {
    mockReturning.mockResolvedValue([]);
    const { addToWaitlist } = await import("@/lib/waitlist");
    const result = await addToWaitlist("existing@example.com", "hash456");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:run lib/__tests__/waitlist.test.ts
```

Expected: FAIL — `addToWaitlist` currently returns `void`, not `boolean`.

- [ ] **Step 3: Update `lib/waitlist.ts`**

Replace the entire file with:

```typescript
import { db } from "@/db";
import { waitlist } from "@/db/schema";

export async function addToWaitlist(
  email: string,
  ipHash: string,
): Promise<boolean> {
  const inserted = await db
    .insert(waitlist)
    .values({ email, ipHash })
    .onConflictDoNothing({ target: waitlist.email })
    .returning();

  return inserted.length > 0;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test:run lib/__tests__/waitlist.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/waitlist.ts lib/__tests__/waitlist.test.ts
git commit -m "feat: addToWaitlist returns boolean for new vs duplicate insert"
```

---

## Task 3: Return 409 for duplicate emails in the API route

**Files:**
- Modify: `app/api/waitlist/route.ts`

- [ ] **Step 1: Update the route handler**

In `app/api/waitlist/route.ts`, change the `addToWaitlist` call block (currently line 50):

Old:
```typescript
await addToWaitlist(parsed.data.email, ipHash);

return ok("You're on the list!");
```

New:
```typescript
const isNew = await addToWaitlist(parsed.data.email, ipHash);

if (!isNew) return fail("You're already on the list.", 409);

return ok("You're on the list!");
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/waitlist/route.ts
git commit -m "feat: return 409 when email is already on the waitlist"
```

---

## Task 4: Add Sonner Toaster to the root layout

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add `<Toaster>` to `app/layout.tsx`**

Add the import at the top of the file (after existing imports):

```typescript
import { Toaster } from "sonner";
```

Inside the `<body>` tag, add `<Toaster>` after `<BackToTop />`:

```tsx
<body>
  {children}
  <CalendlyBadge />
  <BackToTop />
  <Toaster
    position="top-center"
    expand={false}
    richColors={false}
    closeButton
  />
  <Script
    src="https://assets.calendly.com/assets/external/widget.js"
    strategy="afterInteractive"
  />
</body>
```

- [ ] **Step 2: Add Sonner CSS variable overrides to `app/globals.css`**

Append the following block at the end of `app/globals.css`:

```css
/* Sonner toast overrides — match app design system */
[data-sonner-toaster] {
  --normal-bg: var(--ink-2);
  --normal-border: var(--grey-900);
  --normal-text: var(--white);
  --success-bg: var(--ink-2);
  --success-border: var(--grey-900);
  --success-text: var(--white);
  --error-bg: var(--ink-2);
  --error-border: var(--grey-900);
  --error-text: var(--white);
  --border-radius: var(--radius-sm);
  font-family: var(--font);
}

[data-sonner-toaster] [data-type="success"] [data-icon] svg {
  color: var(--red);
}
```

- [ ] **Step 3: Verify TypeScript is happy**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add Sonner Toaster with app design system styling"
```

---

## Task 5: Update CtaSection to use toasts

**Files:**
- Modify: `app/components/CtaSection.tsx`

Replace the entire file with the following. Key changes:
- Remove `status` state — toasts handle all feedback
- Add try/catch around fetch to handle network failures
- Map status codes to toast variants
- Clear email on 200 or 409; keep it on other errors
- Button always shows "Notify me"

- [ ] **Step 1: Replace `app/components/CtaSection.tsx`**

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import CalendlyButton from "./CalendlyButton";

interface CtaSectionProps {
  isTeamPage?: boolean;
}

export default function CtaSection({
  isTeamPage: _isTeamPage = false,
}: CtaSectionProps) {
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    let response: Response;
    try {
      response = await fetch("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    if (response.status === 200) {
      toast.success("You're on the list!");
      setEmail("");
      return;
    }

    if (response.status === 409) {
      toast.info("You're already on the list.");
      setEmail("");
      return;
    }

    if (response.status === 429) {
      toast.error("Too many attempts. Try again later.");
      return;
    }

    toast.error("Something went wrong. Please try again.");
  }

  return (
    <section className="section cta" id="cta">
      <div className="wrap">
        <div className="cta-grid">
          <div>
            <span className="eyebrow on-dark">Get started</span>
            <h2 style={{ marginTop: 18 }}>
              Your next customers are already looking.{" "}
              <span className="accent-red">Let them find you.</span>
            </h2>
            <p>
              Join the waitlist and we&apos;ll be in touch within 12 hours. Or
              grab 30 minutes directly with a founder.
            </p>
          </div>
          <form className="cta-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Join the cook waitlist</label>
            <div className="cta-form-row">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="your-name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Notify me
              </button>
            </div>
            <p className="cta-trust">
              No spam. You&apos;ll hear from us when it matters.
            </p>
            <div className="cta-divider">
              <span>or</span>
            </div>
            <CalendlyButton
              className="btn btn-ghost on-dark"
              style={{ width: "100%" }}
            >
              Book a 30-minute call with the founders
            </CalendlyButton>
          </form>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the dev server and manually test**

```bash
pnpm dev
```

Open `http://localhost:3000`, scroll to the CTA section and test:
1. Submit a fresh email → expect a dark success toast top-center: "You're on the list!"
2. Submit the same email again → expect an info toast: "You're already on the list."
3. Submit quickly multiple times → expect an error toast: "Too many attempts. Try again later."

- [ ] **Step 4: Commit**

```bash
git add app/components/CtaSection.tsx
git commit -m "feat: replace status state with Sonner toasts in CtaSection"
```
