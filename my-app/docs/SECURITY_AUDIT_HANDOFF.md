# Security Audit Handoff — Remediation

**Created:** 2026-05-31
**Purpose:** Hand off the findings of a full security re-audit so a fresh Cursor
chat can fix them without re-doing the discovery work.
**Scope audited:** `my-app/` — 61 API route files / 65 HTTP handlers, plus
better-auth, Stripe Connect, Twilio OTP, Resend, Cloudflare R2, Drizzle/Neon.
**Method:** Static review of the workspace snapshot. Live infra (Vercel env
vars, WAF, Stripe dashboard config) was **not** inspected — verify those
separately.

> Companion artifact: a categorized canvas at
> `~/.cursor/projects/f-Coding-Projects-Personal-7eats/canvases/security-audit.canvas.tsx`.
> This markdown file is the source of truth for remediation work.

---

## How to use this document (for the next agent)

1. Read the **Working agreement** below before touching code.
2. Work findings in the order given in **Remediation order**. Items 1–3 protect
   funds and are highest leverage.
3. Each finding has: exact `file:line`, the problem, evidence, and a concrete
   fix. Confirm the line still matches before editing (the tree may have moved).
4. Update the **Status** checkbox in each finding as you complete it.
5. Add or update focused Vitest coverage for each fix (see `__tests__/`), then
   run the verification commands.

### Working agreement / guardrails

- Follow `my-app/docs/CLAUDE.md` conventions (Drizzle, Biome, Vitest, `@/`
  imports, server components by default).
- Do **not** commit unless explicitly asked. Do **not** print or commit secrets.
- Money is integer cents end-to-end where you touch it.
- If a change modifies `db/schema/**`, generate a migration
  (`pnpm db:generate`) and apply it against Neon before calling the task done.
- Run after each fix:
  ```bash
  pnpm exec tsc --noEmit
  pnpm lint
  pnpm test:run
  ```

---

## Summary

| Severity | Count | Theme |
|----------|------:|-------|
| Critical | 1 | Stripe webhook fails open |
| High | 5 | Webhook idempotency, escrow race, auth bypass, token logging, missing role check |
| Medium | 7 | Headers, float money, internal-endpoint exposure, OTP rate limit, enumeration, TOCTOU, RLS |
| Low | 6 | Arbitrary photo URL, MIME sniffing, gitignore, XFF spoof, missing role checks, invoice amount |

**Already verified clean — do not re-investigate unless you change it:**
no cross-tenant IDOR (ownership gated by `cookId`/`clientId`), no SQL injection
(Drizzle parameterized, no `sql.raw`), no XSS sinks (`dangerouslySetInnerHTML`
/`eval`), no committed secrets (only `.env.example`), `npm audit --omit=dev`
clean, login route rate-limited, upload type/size validated, payout dedupe via
`onConflictDoNothing`, order-status `VALID_TRANSITIONS` state machine, tokens
hashed at rest (`randomBytes(32)` + SHA-256), timing-safe secret comparisons.

---

## Remediation order

| # | Finding | ID | File |
|---|---------|----|------|
| 1 | Remove unsigned-webhook fallback (fail closed) | C-1 | `app/api/webhooks/stripe/route.ts` |
| 2 | Add webhook idempotency + unique order key | H-1 | `app/api/webhooks/stripe/route.ts` |
| 3 | Make escrow capture atomic + payment-state guarded | H-2 | `.../orders/[orderId]/verify-code/route.ts` |
| 4 | Move email-verify + rate-limit into better-auth config | H-3 | `lib/auth.ts`, `app/api/auth/[...all]/route.ts` |
| 5 | Stop logging raw magic links in production | H-4 | `app/api/internal/_lib.ts` |
| 6 | Enforce `role === 'cook'` in `getCookId` | H-5 | `app/api/business/listings/_lib/cook-auth.ts` |
| 7 | Add security headers | M-1 | `next.config.ts` |
| 8 | Integer-cents money math | M-2 | `app/api/webhooks/stripe/route.ts` |
| 9–15 | Remaining Medium/Low | — | see below |

---

## Critical

### C-1 — Stripe webhook trusts unsigned JSON when secrets are unset (fail-open)

- **Status:** [x] Fixed — fails closed (500) when secret/key missing; unsigned
  parsing now gated behind `NODE_ENV !== "production"` + `STRIPE_WEBHOOK_INSECURE_DEV=1`.
- **File:** `app/api/webhooks/stripe/route.ts` (~line 32–50)
- **Problem:** When `STRIPE_WEBHOOK_SECRET` or `STRIPE_SECRET_KEY` is missing,
  the handler skips `constructEvent` and `JSON.parse`s the raw body. In any
  reachable environment, an attacker can POST a forged `invoice.payment_succeeded`
  and create orders + `authorized` payments and flip subscription state.
- **Evidence:**
  ```ts
  if (webhookSecret && stripe) {
    // ... stripe.webhooks.constructEvent(buf, sig, webhookSecret)
  } else {
    event = JSON.parse(buf.toString()) as Stripe.Event; // trusts attacker input
  }
  ```
- **Fix:** Fail closed. If `webhookSecret` or `stripe` is missing, return
  `500` (misconfiguration) and log a server error — never parse an unverified
  body. If a local-dev bypass is truly needed, gate it behind
  `process.env.NODE_ENV !== "production"` **and** an explicit opt-in env flag
  (e.g. `STRIPE_WEBHOOK_INSECURE_DEV === "1"`), never the mere absence of a
  secret.

---

## High

### H-1 — No webhook idempotency → duplicate orders & payments

- **Status:** [x] Fixed — event-id ledger (`stripe_webhook_events`) already in
  place; added a unique index `orders_subscription_period_uidx` on
  `(subscription_id, pickup_at)` + `onConflictDoNothing` in the handler.
  Migration `0007_shiny_ultimo` generated and applied to Neon.
- **File:** `app/api/webhooks/stripe/route.ts` (~line 105–177)
- **Problem:** Stripe delivers at-least-once and retries non-2xx. There is no
  check of `event.id` (or `invoice.id`) and no unique constraint on the natural
  order key. Each retry/replay inserts a new `orders` + `orderPayments` row.
- **Fix:**
  1. Add a `processed_webhook_events` table keyed by `event.id` (unique).
     Insert-on-conflict-do-nothing at the top of the handler; if the row
     already existed, return `200` immediately (already processed).
  2. Add a unique constraint on the natural order key — e.g.
     `(subscription_id, invoice_id)` or `(subscription_id, period_end)` on
     `orders` — so a concurrent duplicate cannot create two orders.
  3. Schema change → `pnpm db:generate` + apply to Neon.

### H-2 — Escrow capture race / no payment-state guard

- **Status:** [x] Fixed — fulfillment update now guards `status = 'ready'`
  (409 if lost race); capture only runs when payment is still `authorized`,
  uses idempotency key `capture-${orderId}`, and the release update is guarded
  on `status = 'authorized'`.
- **File:** `app/api/business/dashboard/orders/[orderId]/verify-code/route.ts` (~line 72–143)
- **Problem:** Reads `order.status === "ready"` then updates without
  `WHERE status = 'ready'`; never checks `orderPayments.status` before
  `paymentIntents.capture`. Two concurrent verify calls can both pass the read
  and double-capture. The `held`/`heldAt` lifecycle exists in schema but is
  never set — the escrow state machine is incomplete.
- **Fix:**
  1. Make fulfillment atomic:
     ```ts
     const [fulfilled] = await db.update(orders)
       .set({ status: "fulfilled", /* ... */ })
       .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId), eq(orders.status, "ready")))
       .returning();
     if (!fulfilled) return /* 409 already-fulfilled / not-ready */;
     ```
  2. Only capture when the payment row is still `authorized`; transition it to
     `released` in the same guarded update.
  3. Pass a Stripe idempotency key to `capture()`
     (e.g. `idempotencyKey: \`capture-${order.id}\``).
  4. Decide whether to wire up the `held`/`heldAt` states or remove them.

### H-3 — Native better-auth catch-all bypasses custom login guards

- **Status:** [x] Fixed — `requireEmailVerification: true` in better-auth config
  applies to all endpoints; cooks marked `emailVerified: true` at create-account
  (trusted setup link) so they aren't blocked; better-auth `rateLimit` enabled
  with tighter custom rules for sign-in/up/forget-password.
  Note: existing cook rows predating this may need `email_verified = true`
  backfilled; better-auth's default limiter store is per-instance `memory` —
  configure a shared store for multi-instance serverless.
- **Files:** `app/api/auth/[...all]/route.ts`, `lib/auth.ts`,
  custom wrapper `app/api/auth/sign-in/route.ts`
- **Problem:** The custom `/api/auth/sign-in` route enforces a 5/15-min IP
  rate-limit and blocks unverified clients. But `toNextJsHandler(auth)` also
  exposes native endpoints (e.g. `/api/auth/sign-in/email`) that have **neither**
  guard. A client can sign in without verifying email, and brute-force avoids
  the DB rate-limiter.
- **Fix:**
  1. Put the email-verification requirement inside better-auth config in
     `lib/auth.ts` (e.g. `emailAndPassword.requireEmailVerification: true`, or
     equivalent for the client role) so it applies to all endpoints.
  2. Confirm better-auth's built-in rate limiting is enabled for production
     (configure `rateLimit` in the better-auth options).
  3. Treat the custom wrapper as a convenience, not the only chokepoint.
  4. Verify cooks (provisioned via trusted setup link) are still allowed —
     they were intentionally not gated on email verification.

### H-4 — Magic setup links (raw token) logged to stdout

- **Status:** [x] Fixed — both `internal/_lib.ts` (setup link) and `lib/auth.ts`
  (`sendVerificationEmail`) only log the full link when
  `NODE_ENV !== "production"`; in production they log just the recipient.
- **File:** `app/api/internal/_lib.ts` (~line 24)
- **Problem:** `console.log(\`[issue-link] magic link for ${to}:\n${link}\`)`
  runs unconditionally. Anyone with log access (host, CI, aggregation, support)
  can hijack onboarding and set a cook's password.
- **Fix:** Gate the full-link log behind `process.env.NODE_ENV !== "production"`.
  In production, log only the destination email and maybe a short token hash
  prefix — never the token/link. Check `lib/auth.ts` too: the
  `sendVerificationEmail` handler also `console.log`s the confirmation URL
  (~line 56) — apply the same gating.

### H-5 — `getCookId` never asserts `role === 'cook'`

- **Status:** [x] Fixed — `getCookId` now returns null unless
  `session.user.role === "cook"`, mirroring the stripe-connect route.
- **File:** `app/api/business/listings/_lib/cook-auth.ts` (~line 7–17)
- **Problem:** `getCookId` only requires a valid session + a `cook_profiles`
  row. It never checks `session.user.role === "cook"`. Used by ~62 business/
  dashboard/financial routes. Not currently exploitable (ownership is gated by
  `cookId`), but the role gate is missing and inconsistent with
  `app/api/setup/stripe-connect/route.ts`, which does check the role.
- **Fix:** Add the role assertion inside `getCookId` (or introduce a shared
  `requireCook()` helper). Optionally also require `setupComplete` for
  dashboard mutations. Verify no legitimate flow relies on a cook profile
  existing before the role is set.

---

## Medium

### M-1 — No security headers
- **Status:** [x] Fixed — `next.config.ts` `headers()` returns CSP, HSTS,
  X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, and
  Permissions-Policy for all routes.
- **File:** `next.config.ts` (currently empty config)
- **Fix:** Add a `headers()` entry returning CSP, `Strict-Transport-Security`,
  `X-Frame-Options: DENY` (or CSP `frame-ancestors`), `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a
  `Permissions-Policy`. Start CSP in report-only if unsure, then enforce.

### M-2 — Float money math in webhook
- **Status:** [x] Fixed — fees computed in integer cents and only formatted to
  a 2dp string for storage.
- **File:** `app/api/webhooks/stripe/route.ts` (~line 145–150)
- **Problem:** Uses `parseFloat` / `.toFixed(2)` for platform fee and payout.
  `lib/stripe-subscriptions.ts` already uses integer cents — be consistent.
- **Fix:** Compute fees in integer cents and only format for display/storage.

### M-3 — Internal endpoints rely solely on a shared key
- **Status:** [~] Documented (ops action required) — added a SECURITY note in
  `internal/_lib.ts` requiring a network-layer control (Vercel WAF allowlist /
  Deployment Protection / private network) + key rotation. No code-only fix is
  possible; this must be configured in live infra.
- **Files:** `app/api/internal/issue-link/route.ts`,
  `app/api/internal/reissue-link/route.ts`, `app/api/internal/_lib.ts`
- **Problem:** Auth is `x-internal-key` vs `INTERNAL_API_KEY` (timing-safe —
  good), but these are publicly routable with no IP allowlist / WAF. Key leak
  = full compromise (approve applications, mint setup links).
- **Fix:** Add a network-layer control (Vercel WAF allowlist, deployment
  protection, or move behind a private network). Rotate `INTERNAL_API_KEY`.
  Keep `proxy.ts` does **not** cover `/api/internal/*` in mind — it's
  handler-only auth today.

### M-4 — `verify-otp` has no app-level rate limit
- **Status:** [x] Fixed — `logAndCheckRateLimit` keyed on `session.user.id`
  (5 attempts / 10 min) before the Twilio check.
- **File:** `app/api/setup/verify-otp/route.ts`
- **Problem:** Relies entirely on Twilio Verify for brute-force protection;
  `send-otp` is rate-limited (3/10min per user) but verify is not.
- **Fix:** Add `logAndCheckRateLimit` keyed on `session.user.id` (e.g. 5
  attempts / 10 min) before calling Twilio.

### M-5 — Subscription ID enumeration + missing `clientId` in WHERE
- **Status:** [x] Fixed — DELETE now scopes by `and(id, clientId)` and returns
  404 for both not-found and wrong-owner; the cancel UPDATE also includes
  `clientId` in its WHERE.
- **File:** `app/api/subscriptions/[subscriptionId]/route.ts` (~line 128, 165)
- **Problem:** DELETE loads by `subscriptionId` alone then returns 403 vs 404
  (leaks existence); UPDATE query omits `clientId`.
- **Fix:** Single query with `and(eq(id, subscriptionId), eq(clientId,
  session.user.id))`; return 404 for both not-found and wrong-owner.

### M-6 — `create-account` token consumption TOCTOU
- **Status:** [x] Fixed — token consumed atomically up front via
  `UPDATE ... SET consumedAt WHERE tokenHash = ? AND consumedAt IS NULL ... RETURNING`;
  only proceeds if a row was returned. Token update removed from the later
  transaction. (A token burned by a subsequent failure can be reissued.)
- **File:** `app/api/setup/create-account/route.ts`
- **Problem:** Token read then consumed; two parallel requests can both pass
  the `consumedAt IS NULL` read before either commits.
- **Fix:** Consume atomically — `UPDATE ... SET consumedAt = now() WHERE token
  = ? AND consumedAt IS NULL RETURNING *` and proceed only if a row returned;
  or `SELECT ... FOR UPDATE` inside the transaction.

### M-7 — RLS not enforced by the app DB connection
- **Status:** [ ] Not started (design note)
- **Files:** `db/index.ts`, `db/schema/payments.ts`
- **Problem:** Tables define `service_role`/`admin` RLS policies, but the app
  connects via `DATABASE_URL` with no `auth.uid()`/JWT context, so all authZ is
  application-layer; RLS does not backstop API routes.
- **Fix:** Either document this explicitly as an accepted design (app-layer
  authZ is the control), or adopt Neon's authorized/JWT connection so RLS
  actually applies. At minimum, ensure the app role is least-privilege.

---

## Low

| ID | Finding | File | Fix |
|----|---------|------|-----|
| L-1 | Dish photo POST accepts arbitrary external URL (`z.url()`) | `.../dishes/[dishId]/photos/route.ts:16` | Restrict to your R2 CDN host(s) via a refined Zod schema. |
| L-2 | Upload MIME validated from client-supplied `file.type`, not magic bytes | `app/api/setup/onboarding/[step]/route.ts:74` | Sniff magic bytes server-side (or validate after R2 processing). |
| L-3 | `/.next/` gitignore rule misses `my-app/.next/` | `.gitignore:17` | Change to `.next/` (no leading slash) so the subdir is ignored. |
| L-4 | Login IP from `x-forwarded-for` is spoofable off-platform | `app/api/auth/sign-in/route.ts:18` | Trust only the platform-set client IP header on Vercel; document the assumption. |
| L-5 | `subscriptions` GET & `tags` GET lack role checks | `app/api/subscriptions/route.ts:29` | Add `role === "client"` to subscription GETs for consistency (tags read is intentionally public). |
| L-6 | Webhook uses DB tier price, not `invoice.amount_paid` | `app/api/webhooks/stripe/route.ts:99` | Reconcile against `invoice.amount_paid` to avoid discount/tax drift. |

---

## Verification checklist (run before declaring done)

```bash
cd my-app
pnpm exec tsc --noEmit
pnpm lint
pnpm test:run
npm audit --omit=dev
```

- [ ] All Critical + High items fixed and covered by tests
- [ ] Webhook rejects unsigned/invalid events (add a Vitest case)
- [ ] Duplicate webhook delivery is a no-op (idempotency test)
- [ ] Concurrent `verify-code` cannot double-capture (test or documented guard)
- [ ] Native better-auth sign-in honors email verification + rate limit
- [ ] No raw tokens/links in production logs
- [ ] `getCookId` rejects non-cook roles
- [ ] Migrations generated + applied for any schema changes
