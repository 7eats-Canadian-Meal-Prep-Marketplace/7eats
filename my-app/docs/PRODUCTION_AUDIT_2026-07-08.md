# 7eats Production Audit — 2026-07-08

Read-only audit of the production codebase. No code was changed. Findings only.

## How this was produced

- **Method:** 8 parallel finder agents (Claude Sonnet 5) each swept one dimension of the codebase, then every raw finding was independently re-checked by an adversarial verifier agent (Claude Fable 5) that read the actual code and tried to refute it.
- **Result:** 10 raw findings → **8 confirmed** (after de-duplicating one that two finders reported), **1 plausible**, **0 false positives**.
- **Dimensions that came back clean** (no confirmed issues): authentication/authorization (IDOR, ownership checks, role gates), injection & input validation (SQL, XSS, redirects, uploads), and data exposure / PII leakage in API responses. These were actively searched and no real issue survived verification. That is a good signal for the auth and validation layers.
- **Severity** shown below is the verifier's adjusted severity (after they weighed real-world exploitability and mitigations), not the finder's initial guess.

## Summary table

| # | Severity | Area | Issue | File |
|---|----------|------|-------|------|
| 1 | High | Payments | `charge.refunded` webhook treats every refund as a full refund | `app/api/webhooks/stripe/route.ts:455` |
| 2 | High | Business logic | All time/cutoff/refund-window math uses server-local time; prod runs UTC, business is Eastern | `lib/lead-time.ts:168` |
| 3 | High | Rate limiting | DB rate limiter is a check-then-insert race with no lock | `lib/rate-limit.ts:19` |
| 4 | Medium | Concurrency | Cook order-status PATCH has no status precondition on final UPDATE | `app/api/business/dashboard/orders/[orderId]/status/route.ts:359` |
| 5 | Medium | Concurrency | Client cancellation writes `status='cancelled'` unconditionally, races the cook path | `lib/orders/cancel-order.ts:260` |
| 6 | Medium | Rate limiting | Better Auth native login/signup limits use in-memory store, ineffective on serverless | `lib/auth.ts:138` |
| 7 | Medium | Availability | `/api/search` and `/api/search/suggest` run heavy trigram queries with no rate limit | `app/api/search/route.ts:17` |
| 8 | Low | Security hardening | CSP `script-src` includes `'unsafe-inline'`, no nonce | `next.config.ts:20` |
| 9 | Low (plausible) | Security hardening | Cron / IndexNow bearer-token check is not constant-time | `app/api/cron/reconcile/route.ts:22` |

---

## 1. `charge.refunded` webhook treats every refund as a full refund — HIGH

**File:** `app/api/webhooks/stripe/route.ts:455` (helper: `lib/stripe/payments.ts:218`)
**Category:** Payments / money movement · **Verdict:** CONFIRMED

The `charge.refunded` handler never inspects `charge.amount_refunded` vs `charge.amount` (nor the `charge.refunded` boolean) before acting. Stripe fires `charge.refunded` on **every** refund, partial or full. Regardless of the amount actually refunded, the handler unconditionally:

1. Sets every matching `order_payments` row to `status: "refunded"` (lines 467-470), and
2. For `type: "full"` rows with a `stripeTopupTransferId`, calls `reverseCookSubsidyTransfer`, which reverses the **entire** platform-funded subsidy transfer via `stripe.transfers.createReversal(transferId, {})` with no `amount` (lib/stripe/payments.ts:218-228).

The `payment_status` enum (`db/schema/enums.ts:57-64`) has no `partially_refunded` state, so a partial refund cannot even be represented correctly.

**Concrete failure:** Support issues a $10 goodwill refund on a $60 captured order that had a platform-funded discount subsidy. Stripe fires `charge.refunded`; the webhook marks the payment row fully `refunded` (despite $50 still captured and the order still to be fulfilled) and claws back **100%** of the subsidy transfer out of the cook's connected account, shorting the cook on an order they still prepare. Worse: once the row is `refunded`, later legitimate refund paths that gate on `authorized/held/released` (`lib/orders/cancel-order.ts:210`, `.../orders/[orderId]/status/route.ts:214`) match nothing and **silently skip issuing any refund** if the customer then cancels. The trigger is a routine Stripe Dashboard/API partial refund, not an exotic edge case.

**Fix direction:** Check `charge.amount_refunded === charge.amount` before marking the row fully `refunded`; for partial refunds, track the partial amount (e.g. an `amountRefunded` column) and reverse only a proportional slice of the subsidy transfer (`createReversal(transferId, { amount })`).

---

## 2. Time/cutoff/refund-window math uses server-local time; production runs UTC — HIGH

**File:** `lib/lead-time.ts:168` (also `lib/orders/readiness.ts`, `lib/cooks/card-schedule.ts:201`, `lib/orders/place-order.ts:366`)
**Category:** Business-logic correctness · **Verdict:** CONFIRMED

Every date computation that drives ordering windows, cutoffs, and refund deadlines (`orderDeadlineForPickupDay`, `isPickupDayBookable`, `earliestPickup`, `generateFulfillmentSlotIsos`, `cancelByDate`) uses plain JS `Date` getters/setters (`setHours`, `getDate`, `getDay`) with **no timezone conversion anywhere**. A repo-wide search for `America/Toronto`, `timeZone`, `Intl.DateTimeFormat`, `date-fns-tz`, `luxon`, and `TZ=` returns zero matches; `vercel.json` sets no `TZ`. Vercel serverless defaults to **UTC**. The business is Ontario-only (`ACTIVE_PROVINCE = "ON"`), and cooks configure windows/cutoffs as bare `HH:MM:SS` strings clearly meant to be Eastern.

**Why it bites in production (not just in the browser):** These functions run **server-side** at money-moving decision points, so this is not merely a display bug:

- `lib/orders/place-order.ts` calls `earliestFulfillmentWindow(..., new Date())` at order placement and **stores the UTC-skewed window** as the order's `fulfillmentWindowStart/End` snapshot.
- The refund decision in the `DELETE` cancel path (`cancel-order.ts` → `isClientRefundEligible` → `cancelByDate` → `orderDeadlineForPickupDay`) uses that skewed snapshot.
- The cook "mark ready" guard (`canMarkReady`, status route line 241) uses UTC `startOfDay`.

**Concrete failure (EDT, UTC−4):** A customer cancelling at 8:00 pm Eastern is inside the UI-advertised refund window (10 pm ET, computed client-side in Eastern) but **past** the server-enforced deadline (22:00 UTC = 6 pm ET), so `executeCancellation` takes the non-refund branch and **captures the payment to the cook, denying a refund the customer was told they had.** Cutoffs, slot generation, and the "mark ready" window are all shifted 4-5 hours, and the client-side display (Eastern) disagrees with server enforcement daily.

**Fix direction:** Pin `TZ=America/Toronto` in the Vercel environment, or (more robustly) convert cook-configured local times using a timezone-aware library rather than relying on the process default.

---

## 3. DB rate limiter is a check-then-insert race with no locking — HIGH

**File:** `lib/rate-limit.ts:19`
**Category:** Rate limiting / race condition · **Verdict:** CONFIRMED
*(Independently reported by two finders — race-condition and rate-limiting dimensions — same root cause.)*

`logAndCheckRateLimit()` runs `SELECT count(*) ... WHERE ipHash = key AND attemptedAt > windowStart`, compares to `maxAttempts`, and only then does a **separate** `INSERT`. There is no transaction, no `SELECT ... FOR UPDATE`, no advisory lock, and no unique constraint on `rate_limit_log` to serialize callers. The DB client is `drizzle-orm/neon-http` (stateless HTTP), so the SELECT and INSERT are two independent round trips that cannot be atomic. N concurrent requests with the same key all run their SELECT before any INSERT commits, all see a count under the threshold, and all pass.

This is the **sole** app-level rate limit for OTP send/verify (client, setup, business, guest-email), sign-in, sign-up, forgot/reset-password, guest checkout, and order placement. `proxy.ts` adds no upstream guard.

**Concrete failure:** Fire 50 parallel `POST`s to `/api/auth/client/send-otp` (or `guest-email/send-otp`) within the tens-of-ms window; all observe count 0 (< 3) and each returns allowed, triggering 50 Twilio/email OTP sends instead of 3 — SMS/email bombing and direct cost amplification. Same bypass weakens brute-force protection on login, OTP-verify, and password reset. Endpoints behind Twilio Verify have partial defense-in-depth; **email-OTP, login, order placement, and password reset have no backstop.**

**Fix direction:** Make check-and-increment atomic — a single `INSERT ... SELECT ... WHERE NOT EXISTS (count subquery)`, or a `pg_advisory_xact_lock(hashtext(key))` around the select+insert (the pattern already used correctly in `lib/orders/platform-discount-repo.ts`), or a counter table with `UNIQUE(key, window_bucket) ... ON CONFLICT DO UPDATE ... RETURNING`.

---

## 4. Cook order-status PATCH has no status precondition — MEDIUM

**File:** `app/api/business/dashboard/orders/[orderId]/status/route.ts:359`
**Category:** Race condition · **Verdict:** CONFIRMED (finder said high, verifier adjusted to medium)

The `PATCH` reads `order.status` once (lines 83-107), validates the transition against that snapshot via `VALID_TRANSITIONS`, runs Stripe capture/refund + `orderPayments` writes (lines 119-235), then writes the new status with `.where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))` only — **no `eq(orders.status, previousStatus)` guard**, no transaction, no row lock. Two concurrent PATCHes (double-click, or racing the client-cancel path) can both pass the transition check and both run their side effects; last write wins.

**Concrete failure:** An order in `confirmed` with authorized payment. A `confirmed → ready` request races a `confirmed → cancelled`. Both read `confirmed` and pass. The `ready` path generates a pickup code and emails "your order is ready, use code X"; the cancel path refunds the payment and marks `orderPayments` refunded. Neither UPDATE has a status precondition, so both land and both return 200 — DB ends up `ready` with a live pickup code while Stripe shows the payment fully refunded (or the customer's cancellation is silently overwritten back to `ready`).

Severity is medium (not high) because actual fund loss at handoff is blocked downstream: the only route that sets `fulfilled` is `verify-code`, which requires `status='ready'` in its WHERE and runs `findUncollectiblePayment`; a refunded-but-`ready` order gets a 402 at code verification. What remains real: persisted status diverging from the Stripe outcome, and misleading customer emails.

**Fix direction:** Wrap read-check-mutate in one transaction with `SELECT ... FOR UPDATE`, or add `eq(orders.status, previousStatus)` to the final UPDATE and treat 0 rows as a 409 — exactly the compare-and-set the sibling `verify-code` route already does correctly.

---

## 5. Client cancellation writes `status='cancelled'` unconditionally — MEDIUM

**File:** `lib/orders/cancel-order.ts:260`
**Category:** Race condition · **Verdict:** CONFIRMED

`executeCancellation` checks `isClientOrderCancellable(order)` against a stale snapshot, runs the Stripe refund/capture loop, then does `db.update(orders).set({ status: "cancelled", ... }).where(eq(orders.id, order.id))` with **no `eq(orders.status, ...)` precondition** and no transaction. This is the same missing optimistic-concurrency pattern as finding #4, and because both endpoints write the same `orders.status` column independently, a client cancel and a cook `ready`/`cancelled` PATCH race across the two files.

**Concrete failure:** Order `confirmed`, refund-eligible. Client cancels while the cook marks `ready`. The window between the client SELECT and its final UPDATE spans multiple Stripe round trips (hundreds of ms to seconds), so ordinary bad timing suffices. Final state can be `status='ready'` with a fresh pickup code and `cancelledAt` set, PaymentIntent refunded at Stripe, customer emailed "cancelled and refunded" — the cook can prepare and release food for a fully refunded order. No transaction, lock, or reconciliation job repairs it (`cron/reconcile` only handles abandoned checkouts, subsidy retries, and stale-auth alerts).

**Fix direction:** Same as #4 — guard the UPDATE with `eq(orders.status, order.status)` in a transaction and treat 0 rows as "modified concurrently, refetch."

---

## 6. Better Auth native login/signup limits use in-memory store — MEDIUM

**File:** `lib/auth.ts:138`
**Category:** Rate limiting · **Verdict:** CONFIRMED (finder said high, verifier adjusted to medium)

`lib/auth.ts` configures `rateLimit` custom rules (5/900s for `/sign-in/email`, `/sign-up/email`, `/forget-password`) but sets **no `secondaryStorage`**. The installed better-auth 1.6.11 falls back to a module-level in-memory `Map` in that configuration. On Vercel, concurrent invocations spread across separate function instances, each with its own counter (and cold starts reset it). These native routes are exposed unwrapped via `app/api/auth/[...all]/route.ts`, and the app's own DB-backed limiter only covers the exact path `/api/auth/sign-in`, so `POST /api/auth/sign-in/email` reaches better-auth with only the in-memory limiter.

**Note:** This is already flagged as an open caveat in `docs/SECURITY_AUDIT_HANDOFF.md` (H-3) and `PRE_LAUNCH_AUDIT_REPORT.md` (BLK-7); it has not been changed in code. Effective allowed throughput becomes roughly `5 × (instances touched + recycles)` per window instead of 5. Medium rather than high because each instance still throttles (a multiplier, not an unlimited bypass) and IP-keyed limits are bypassable via IP rotation regardless of store.

**Fix direction:** Configure a shared `secondaryStorage` (Upstash Redis, or a Postgres-backed adapter over the existing `rate_limit_log`) so limits hold across instances.

---

## 7. Search endpoints run heavy queries with no rate limit — MEDIUM

**File:** `app/api/search/route.ts:17`, `app/api/search/suggest/route.ts`
**Category:** Availability / cost amplification · **Verdict:** CONFIRMED

Both endpoints are unauthenticated and call **no** rate-limit check, unlike 22 other routes in the app. Each request runs a query over `cook_search_index` computing `ts_rank`, `word_similarity` (trigram), and a haversine distance expression for every row in the geo bounding box, then `loadCookCards()` runs several more hydration queries. `suggest` additionally runs a second `word_similarity` query against `tags` on every keystroke-level request. The directly comparable unauthenticated `app/api/delivery/distance` route **does** guard with `logAndCheckRateLimit(..., { windowMinutes: 15, maxAttempts: 60 })`.

**Concrete failure:** An unauthenticated client loops `GET /api/search?q=...&lat=...&lng=...` (varying `q` to defeat caching), driving unbounded Neon Postgres CPU/IO with no per-IP throttle anywhere in the path. Medium (not high) because the bounding-box prefilter keeps candidate sets small at current scale, `LIMIT` caps hydration, and Vercel provides baseline DDoS mitigation. (Note: `/api/cooks` browse is also unguarded and uses `loadCookCards`, so the fix should cover it too.)

**Fix direction:** Add `logAndCheckRateLimit('search:' + hashIp(getClientIp(req)))` at the top of both GET handlers, consistent with `delivery/distance`.

---

## 8. CSP `script-src` includes `'unsafe-inline'` — LOW

**File:** `next.config.ts:20`
**Category:** Security hardening · **Verdict:** CONFIRMED (finder said medium, verifier adjusted to low)

Production CSP sets `script-src 'self' 'unsafe-inline' https://js.stripe.com https://assets.calendly.com` (and `style-src` also carries `'unsafe-inline'`), with no nonce or hash allowlist. `'unsafe-inline'` whitelists all inline scripts, which is the exact vector CSP is meant to block, so CSP provides no inline-script XSS backstop.

Low, not medium: there is **no injection sink today** — all 11 `dangerouslySetInnerHTML` uses render static JSON-LD (`JSON.stringify` of developer-defined objects), never user content, and the other directives (`frame-ancestors 'none'`, `object-src 'none'`, restricted `connect-src`/`form-action`/external script origins) still provide real protection. This is a defense-in-depth gap: if a future code path ever lets attacker HTML into a page, CSP won't stop the injected `<script>`.

**Fix direction:** Move to a per-request nonce (generated in `proxy.ts` and threaded into script/style tags) so `'unsafe-inline'` can be dropped.

---

## 9. Cron / IndexNow bearer-token check is not constant-time — LOW (plausible)

**File:** `app/api/cron/reconcile/route.ts:22` (also `cron/abandoned-checkouts/route.ts:12`, `indexnow/route.ts:17`)
**Category:** Security hardening · **Verdict:** PLAUSIBLE

All three secret-protected internal endpoints compare the `Authorization` header to `Bearer ${CRON_SECRET}` with plain `!==` instead of `crypto.timingSafeEqual`. The code is accurately described and it deviates from constant-time comparison best practice, but the exploit is theoretical: V8 string-comparison timing deltas are sub-nanosecond per character, far below network/serverless jitter, so no practical byte-by-byte extraction over HTTP is realistic. The `!secret ||` guard also fails closed if the env var is missing, and plain `!==` is what Vercel's own cron docs show. Hygiene finding, not a traceable exploit.

**Fix direction:** Use `crypto.timingSafeEqual` on equal-length buffers in all three routes.

---

## Notes on scope

- **No changes were made to any file.** This document is the sole output.
- Findings #4 and #5 share a root cause (missing optimistic-concurrency guard on `orders.status` writes) and are best fixed together with the compare-and-set pattern the `verify-code` route already uses.
- Findings #3 and #6 are two different rate-limiting weaknesses (app DB limiter vs. Better Auth native limiter); both should be addressed for the auth surface to be sound.
- Clean dimensions (auth/authz IDOR & role checks, SQL/XSS injection, PII exposure) were searched and verified, not skipped.
