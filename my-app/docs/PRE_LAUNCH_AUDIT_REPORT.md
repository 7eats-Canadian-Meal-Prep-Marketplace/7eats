# Pre-Launch Audit Report

**Date:** 2026-06-22  
**Scope:** `my-app/` — static code review + test run (689 tests). Live infrastructure (Vercel env, WAF, Stripe dashboard, DNS, Neon console) was **not** inspected; ops items are flagged separately.  
**Method:** Automated grep, file reads, subagent exploration, `pnpm test:run` (97 files, 689 passed).  
**Companion docs:** `docs/SECURITY_AUDIT_HANDOFF.md` (remediation tracker), `docs/go-live-readiness.md` (ops checklist).

---

## Executive summary

The codebase is **close to launch-ready** for a pilot marketplace. Core money paths (server-side pricing, Stripe webhook signature + idempotency, guest checkout tokens, cook tenant isolation) are solid. **689/689** unit/integration tests pass.

**Before taking real money at scale**, address the **blocking/critical** items in the next section — mostly unauthenticated abuse surfaces (Mapbox proxy, cook applications), internal API network hardening, and delivery env configuration.

**Not blocking launch** but should land in week one: cook notification preference bugs, dead-code cleanup, image performance on browse paths, em-dash copy sweep, and legacy subscription schema retirement.

---

## Remediation status (2026-06-23)

Code-level remediations applied in a follow-up session. Verified with `tsc --noEmit` (clean), `biome check app lib` (clean — only pre-existing `globals.css` `!important` warnings), and `pnpm test:run` (**96 files, 687 passed**).

**Resolved (code):**

- **BLK-1** — `delivery/distance` rate-limited (60 / 15 min per hashed IP); `address/geocode` route deleted outright (dead code), along with its now-orphaned `lib/geocoding.ts`.
- **BLK-2** — `business/application` rate-limited (3 / 60 min per hashed IP).
- **BLK-3** — `internal/issue-link` + `internal/reissue-link` now call `verifyInternalRequest` (key **+** `INTERNAL_API_ALLOWLIST` IP check, enforced in production); logic centralized in `lib/internal-api.ts`. `INTERNAL_API_KEY` / `INTERNAL_API_ALLOWLIST` added to env warnings + `.env.example`.
- **BLK-4** — `MAPBOX_SECRET_TOKEN` promoted to `CRITICAL` env (boot fail-fast in production). *Ops dependency: must be set in Vercel before deploy.*
- **BLK-6** — cook new-order email now gated on `cook_profiles.email_notifications_new_order`.
- **BLK-8** — `account.updated` Stripe webhook now re-fetches live Connect status and syncs `setup_complete` (uses existing `readStripeConnectAccountStatus` / `isStripeFullyConnected` helpers).
- **Rate limits** — `reset-password` (10 / 15 min) and `confirm-payment` (20 / 5 min per order+IP) added.
- **Dead code** — deleted orphan routes (`service-area`, `address/geocode`, `checkout/customer-session`), `AddressAutocomplete/**`, schema stubs (`user_preferences.ts`, `users.ts`), and `lib/geocoding.ts`.
- **Content/UX** — em-dash sweep on user-facing copy; platform fee copy locked at **7.5%**; browse/menu/orders images migrated to `next/image`; placeholder `"TBD"` timing replaced with `"Date to be confirmed"`.
- **Build/compile fixes** — stray `}` in `cooks/[id]/menu/page.module.css`; botched mock merge in `business-application.test.ts`; duplicate `ip` declaration in `business/application/route.ts`; `user-profile-photo` route params typed `Request` (cleared pre-existing `tsc` errors).

**Still open (intentionally deferred):**

- **BLK-5 / BLK-9 / BLK-10** — Resend DNS, Neon PITR, uptime monitor: ops tasks, not code.
- **BLK-7** — Better Auth shared rate-limit store: accepted at pilot volume; `lib/auth.ts` unchanged.
- **§20 DB drops** — unused tables/columns left in place; dropping them is a post-launch migration (data risk).
- `CLAUDE.md` still references the deleted `db/schema/users.ts` (stale doc note; left for the owner to amend).

---

## Blocking & critical issues

These items can cause **financial loss, security compromise, or broken core flows** if ignored.

| ID | Severity | Issue | Evidence | Measurable pass criterion |
|----|----------|-------|----------|-------------------------|
| **BLK-1** | **CRITICAL** | Unauthenticated Mapbox proxy endpoints — cost abuse / DoS | `app/api/address/geocode/route.ts`, `app/api/delivery/distance/route.ts` have no auth and no `logAndCheckRateLimit` | Add IP rate limits (e.g. 30/hr geocode, 60/hr distance) **or** require session; verify 429 after threshold |
| **BLK-2** | **CRITICAL** | Cook application spam | `app/api/business/application/route.ts` — public POST, no rate limit | Add IP rate limit (e.g. 3/hr); verify 429 on abuse |
| **BLK-3** | **CRITICAL (ops)** | Internal admin APIs publicly routable | `app/api/internal/issue-link`, `reissue-link` — key-only auth (`internal/_lib.ts`) | WAF/IP allowlist or Vercel Deployment Protection on `/api/internal/*`; `INTERNAL_API_KEY` set and rotated; leak test returns 401 without key |
| **BLK-4** | **HIGH** | Delivery orders fail silently at boot if Mapbox unset | `MAPBOX_SECRET_TOKEN` is feature-warn only (`lib/env.ts` L30); `place-order.ts` returns 502 on delivery without token | If delivery launches: add to `CRITICAL` env **or** hard-disable delivery UI when token missing; verify delivery E2E in staging |
| **BLK-5** | **HIGH (ops)** | Resend domain DNS not verifiable in repo | No SPF/DKIM/DMARC docs; emails may land in spam | Mail-tester score ≥ 8/10 for `noreply@7eats.ca`; Resend domain verified |
| **BLK-6** | **HIGH** | Cook new-order email ignores preference toggle | `sendOrderPlacedEmailToCook` called unconditionally in `lib/orders/confirm-order-payment.ts` L113; `emailNotificationsNewOrder` only in settings schema | Gate send on `cook_profiles.email_notifications_new_order`; test proves off = no email |
| **BLK-7** | **MEDIUM-HIGH** | Better Auth rate limit may not share state across serverless instances | `lib/auth.ts` — in-memory store default | Configure shared rate-limit store for multi-instance prod **or** accept risk at pilot volume |
| **BLK-8** | **MEDIUM** | `account.updated` Stripe webhook is no-op | `app/api/webhooks/stripe/route.ts` — cook can stay `setupComplete` after Stripe restricts transfers | Handle `account.updated` to flag/disable cooks when `stripe_transfers` inactive |
| **BLK-9** | **MEDIUM (ops)** | Neon PITR / backup restore untested | Documented in `go-live-readiness.md` C1 | PITR enabled; restore drill completed once in last 30 days |
| **BLK-10** | **MEDIUM (ops)** | No external uptime monitor wired | `GET /api/health` exists and returns 503 on DB failure | Monitor hits `/api/health` every 1–5 min; alert routes to on-call |

### Launch gate recommendation

| Gate | Items |
|------|-------|
| **Hard block** | BLK-1, BLK-2, BLK-3, BLK-4 (if delivery enabled), BLK-5 |
| **Block if promising delivery day one** | BLK-4 |
| **Fix before public cook onboarding at scale** | BLK-6, BLK-8 |
| **Ops day-one** | BLK-9, BLK-10, `CRON_SECRET`, Neon pooled `DATABASE_URL` |

---

## 1. Security — authentication & authorization

| Audit | Status | Evidence |
|-------|--------|----------|
| Email verification required for clients | **PASS** | `lib/auth.ts` — `requireEmailVerification: true`, `autoSignIn: false` |
| Better Auth rate limits on sign-in/up/forgot | **PASS** | `lib/auth.ts` L138–147 — 5/15min on sensitive endpoints |
| Custom sign-in wrapper rate-limited | **PASS** | `app/api/auth/sign-in/route.ts` — 5/15min per hashed IP |
| OTP send/verify rate-limited | **PASS** | `client/send-otp` (3/10min), `client/verify-otp` (5/10min), `setup/*`, `business/phone/verify-otp` |
| `getCookId` enforces `role === "cook"` | **PASS** | `app/api/business/_lib/cook-auth.ts` |
| Cross-tenant IDOR on orders | **PASS** | Orders scoped by `clientId` / `cookId` in route handlers |
| Guest order access token security | **PASS** | SHA-256 hash at rest, `timingSafeEqual` (`lib/guest-order-access.ts`) |
| Native Better Auth bypasses portal audience check | **PARTIAL** | Custom `sign-in` blocks wrong portal; native `/api/auth/sign-in/email` does not |
| `reset-password` has no app rate limit | **FAIL** | `app/api/auth/reset-password/route.ts` — relies on Better Auth only |
| `DELETE /api/orders/[orderId]` missing explicit client role check | **PARTIAL** | `cancelClientOrder` scopes by `clientId`; cooks get 404 not IDOR |
| Admin `admin_*` tables wired to UI | **N/A** | Schema exists; zero app references — unused |

---

## 2. Security — injection & input attacks

| Audit | Status | Evidence |
|-------|--------|----------|
| SQL injection | **PASS** | Drizzle parameterized queries; raw `sql` templates use bound params (`lib/search/query.ts`, health check) |
| XSS via `dangerouslySetInnerHTML` | **PASS** | Only JSON-LD structured data in marketing/legal layouts — no user content |
| Server-side Zod validation on order creation | **PASS** | `createOrderBodySchema` in `lib/orders/place-order.ts` |
| File upload type/size validation | **PASS** | Onboarding uploads validated; dish photos via R2 |
| Arbitrary external URL on dish photo POST | **LOW FAIL** | `business/dishes/[dishId]/photos` accepts `z.url()` — restrict to R2 CDN host (SECURITY_AUDIT_HANDOFF L-1) |
| MIME from client `file.type` only | **LOW FAIL** | Onboarding upload — magic-byte sniffing not implemented (L-2) |

---

## 3. Security — payments & money

| Audit | Status | Evidence |
|-------|--------|----------|
| Webhook signature verification | **PASS** | `constructEvent` on raw body; 400 on failure (`webhooks/stripe/route.ts` L35–60) |
| Webhook fail-closed without secrets | **PASS** | 500 when no webhook secrets configured (L27–32) |
| Webhook idempotency | **PASS** | `stripe_webhook_events` insert + `onConflictDoNothing` (L63–87); tested in `webhooks-stripe.test.ts` |
| Server-side order pricing | **PASS** | `placeClientOrder` loads DB prices, applies promos, `computeOrderChargeBreakdown` |
| Min/max order qty server-side | **PASS** | `place-order.ts` L123–137 |
| Delivery radius server-side | **PASS** | Mapbox distance + `calcDeliveryFee` — client coords not trusted for fee |
| Guest checkout same pipeline | **PASS** | `orders/guest/route.ts` → `placeClientOrder` |
| Confirm-payment PI amount vs order total | **GAP** | No explicit `pi.amount === order.total` check — mitigated by server-created PI |
| Live Stripe capability check at order time | **PARTIAL** | Checks `setupComplete` + `stripeAccountId`; no live API re-fetch |
| Subscription webhook handler still active | **SUSPECT** | `invoice.payment_succeeded` creates subscription orders — launch uses dish model only |
| Integer cents money math | **PASS** | Fees in cents in webhook (M-2 fixed per SECURITY_AUDIT_HANDOFF) |
| Escrow capture race | **PASS** | `verify-code` atomic status guard (H-2 fixed) |

---

## 4. Security — secrets & infrastructure

| Audit | Status | Evidence |
|-------|--------|----------|
| No committed secrets | **PASS** | Only `.env.example` placeholders; `validateEnv()` at startup |
| Production fail-fast on critical env | **PASS** | `lib/env.ts` — 8 critical vars throw in production |
| Security headers (CSP, HSTS, etc.) | **PASS** | `next.config.ts` `headers()` — CSP, HSTS 2yr, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy |
| `INTERNAL_API_KEY` not in CRITICAL list | **FAIL** | Missing from `lib/env.ts`; silent 401 if unset |
| RLS as DB backstop | **NOT ENFORCED** | App uses service connection; authZ is application-layer only (M-7 documented) |
| `.gitignore` for `.next/` | **LOW** | Leading-slash rule may miss `my-app/.next/` (L-3) |

---

## 5. Security — API & network

| Audit | Status | Evidence |
|-------|--------|----------|
| CORS wide open | **PASS** | No `Access-Control-Allow-Origin: *` — same-origin Next.js app |
| `proxy.ts` protects pages not APIs | **BY DESIGN** | API auth per-route; matcher excludes `/api/*` |
| Rate limit on `POST /api/orders` | **PASS** | 10 / 5min |
| Rate limit on guest order routes | **PASS** | POST 8/hr, GET 60/15min |
| Rate limit on waitlist | **PASS** | `waitlist/route.ts` |
| Rate limit on search/cooks/tags GET | **FAIL** | Public read endpoints unbounded — low-medium DB load risk |
| Rate limit on `confirm-payment` | **FAIL** | Polling abuse possible — medium |

---

## 6. Reliability — application stability

| Audit | Status | Evidence |
|-------|--------|----------|
| Health endpoint | **PASS** | `GET /api/health` — `SELECT 1`, 503 on DB failure |
| Env validation at boot | **PASS** | `instrumentation.ts` → `validateEnv()` |
| Error monitoring (Sentry) | **PASS** | `@sentry/nextjs`, `global-error.tsx`, tunnel `/monitoring`, CI `SENTRY_AUTH_TOKEN` |
| Sentry DSN from env | **PARTIAL** | DSN hardcoded in config files; `go-live-readiness` says set env vars |
| Sentry `tracesSampleRate: 1` | **WARN** | 100% tracing may be costly at scale |
| `sendDefaultPii: true` | **WARN** | Confirm privacy policy alignment |
| Rollback procedure documented | **PARTIAL** | Vercel deploy rollback; no formal runbook in repo |
| Test suite green | **PASS** | 689/689 tests, 97 files (2026-06-22) |
| TypeScript clean | **UNKNOWN** | Not run in this audit; `go-live-readiness` notes occasional tsc issues in test files |

---

## 7. Reliability — performance & speed

| Audit | Status | Evidence |
|-------|--------|----------|
| `next/image` on marketing | **PASS** | ~26 components use `next/image` |
| Raw `<img>` on browse/menu/orders | **FAIL** | `cooks/[id]/menu/page.tsx`, `cooks/[id]/page.tsx`, `_shell.tsx` search thumbnails, `orders/_cook-visual.tsx` |
| Mapbox components lazy-loaded | **PASS** | `dynamic()` on `AddressSearchInput` |
| R2 remote patterns in next config | **PASS** | `next.config.ts` images.remotePatterns |
| DB indexes for browse/search | **PASS** | `cook_search_index` migration `0007`; go-live doc notes index work done |
| Load test executed | **FAIL** | Not in repo; recommended in `go-live-readiness.md` B4 |
| Core Web Vitals measured | **NOT RUN** | No Lighthouse artifacts in audit |

---

## 8. Reliability — database & data

| Audit | Status | Evidence |
|-------|--------|----------|
| Migrations versioned | **PASS** | `db/migrations/0000`–`0011` |
| Money as numeric/integer cents | **PASS** | Order payments, dish prices |
| Webhook idempotency table | **PASS** | `stripe_webhook_events` |
| Neon pooled connection | **OPS** | Documented in go-live B3 — must use `-pooler` host |
| PITR / backup restore tested | **OPS FAIL** | Not verifiable from code |
| Reconciliation cron | **PASS (code)** | `api/cron/reconcile` — flags authorized >48h; needs `CRON_SECRET` + schedule in `vercel.json` |

---

## 9. Reliability — third-party services

| Audit | Status | Evidence |
|-------|--------|----------|
| Stripe webhooks registered | **OPS** | `scripts/setup-stripe-webhooks.ts` — verify in Stripe dashboard |
| Twilio OTP flows | **PASS** | Client, setup, business phone routes + tests |
| Resend transactional email | **PASS (code)** | `lib/email.ts`; no-op without `RESEND_API_KEY` |
| SMS order updates gated | **PASS** | `lib/order-client-notifications.ts` — prefs + phone verified |
| SMS/email failures to Sentry | **FAIL** | `lib/sms.ts` only `console.error` |
| Mapbox for delivery | **CONDITIONAL** | Required for delivery; warn-only at boot |

---

## 10. Business logic & data integrity

| Audit | Status | Evidence |
|-------|--------|----------|
| Min order enforced server-side | **PASS** | `place-order.ts` |
| Cart cook mismatch blocked | **PASS** | Single cook per cart in `placeClientOrder` |
| Delivery out-of-range at placement | **PASS** | Server rejects in `place-order.ts` |
| Address required before add-to-cart (menu) | **PASS** | `cooks/[id]/menu/page.tsx` — `requireAddressForAdd()` |
| Address gate on browse/search | **PASS** | `_shell.tsx` `mustSetAddress` |
| Duplicate order on double-submit | **PARTIAL** | Idempotency on payment confirm; UI may still double-click — verify client guard |
| Order status state machine | **PASS** | `VALID_TRANSITIONS` in status routes; tested |
| Promotion `FOR UPDATE` lock | **PASS** | Documented in go-live; contention scenario in tests |
| Delivery out-of-zone at checkout UI | **KNOWN GAP** | `go-live-readiness.md` — cart shows warning but checkout may still submit with $0 fee snapshot |
| Platform fee copy inconsistent (7.5% TBD) | **FAIL (content)** | Multiple references; pricing not locked |
| Cook notification SMS toggle | **FAIL** | `smsNotificationsNewOrder` stored but never used in send path |

---

## 11. UX & content quality

| Audit | Status | Evidence |
|-------|--------|----------|
| Responsive layouts (app shell) | **PASS (spot check)** | Mobile nav, browse filter bar, menu two-column → stacked |
| Empty states (browse, cart) | **PASS** | `BrowseEmpty`, cart empty copy |
| 404 for missing cook/menu | **PASS** | Menu page not-found state |
| Placeholder copy in production UI | **PARTIAL** | `orders/[id]` shows `"TBD"` for missing `timingSchedule`; `business-auth/setup/saved` has TODO comment for email display |
| Em dashes in user-facing copy | **FAIL** | Multiple UI strings e.g. settings ("SMS is off — you will not receive…"), promotions tab ("Network error — please try again"), business orders verify feedback, inbox `"—"` date fallback |
| Currency formatting consistent | **PASS (spot check)** | `.toFixed(2)` on prices |
| Favicon / OG metadata | **PASS** | `app/layout.tsx` metadataBase, OG, Twitter cards |
| Legal links in footer / checkout | **PASS** | Terms acceptance on guest checkout, cook application |

---

## 12. Accessibility

| Audit | Status | Evidence |
|-------|--------|----------|
| Form labels on checkout/settings | **PASS (spot check)** | Checkout contact fields labeled |
| Modal focus trap / Escape | **PASS (spot check)** | Menu conflict dialog, address modal |
| `aria-label` on icon buttons | **PARTIAL** | Some +/- qty buttons rely on visible context |
| axe / Lighthouse a11y audit | **NOT RUN** | No artifacts |
| Color contrast | **NOT RUN** | Manual review needed on muted text in dark sections |

---

## 13. SEO & discoverability

| Audit | Status | Evidence |
|-------|--------|----------|
| `robots.txt` | **PASS** | `public/robots.txt` — blocks `/api/`, private app paths |
| `sitemap.ts` | **PASS** | 11 public URLs at `https://www.7eats.ca` |
| Root metadata | **PASS** | `app/layout.tsx` |
| JSON-LD structured data | **PASS** | Organization + WebSite on homepage |
| Private routes noindex | **PARTIAL** | robots.txt blocks paths; verify no accidental indexing of `/app/*` |

---

## 14. Legal & compliance

| Audit | Status | Evidence |
|-------|--------|----------|
| Terms of Service | **PASS** | `app/terms/page.tsx` |
| Privacy Policy | **PASS** | `app/privacy/page.tsx` — documents Resend, Twilio, Sentry |
| Cook terms | **PASS** | `app/cook-terms/page.tsx` |
| Refund policy | **PASS** | `app/refund-policy/page.tsx` |
| Food safety | **PASS** | `app/food-safety/page.tsx` |
| Community guidelines | **PASS** | `app/community-guidelines/page.tsx` |
| Legal acceptances audit trail | **PASS** | `legal_acceptances` table; sign-up, guest checkout, cook application |
| PCI scope minimized | **PASS** | Stripe Elements / PaymentIntent — no raw card data on server |

---

## 15. Operations & observability

| Audit | Status | Evidence |
|-------|--------|----------|
| Structured logging with order IDs | **PARTIAL** | Some routes log errors; not uniform across all critical paths |
| Cron reconcile alerts team | **CONDITIONAL** | Emails only if `RESEND_TEAM_EMAIL` set |
| Dispute runbook | **OPS FAIL** | Process not in repo (`go-live-readiness` C3) |
| CI on push | **PASS** | `.github/workflows/production.yaml`, `preview.yaml` — lint, test, vercel build |
| Husky pre-commit | **PASS** | Biome on staged files |
| `tsc` in CI | **PARTIAL** | Relies on `vercel build`, not explicit `tsc --noEmit` |

---

## 16. Deployment & release

| Audit | Status | Evidence |
|-------|--------|----------|
| `validateEnv()` in production | **PASS** | `instrumentation.ts` |
| `.env.example` documented | **PASS** | Stripe, Twilio, Resend, Mapbox, R2, cron |
| Vercel cron for reconcile | **PASS** | `vercel.json` schedule `0 9 * * *` |
| Source maps to Sentry | **PASS** | `withSentryConfig` in `next.config.ts` |
| Feature flags / kill switches | **FAIL** | No global payment kill switch |

---

## 17. Email & SMS notifications

| Audit | Status | Evidence |
|-------|--------|----------|
| Client order update email gated | **PASS** | `shouldSendOrderUpdateEmail` in `order-client-notifications.ts` |
| Client order update SMS gated | **PASS** | Requires `phoneVerified` + SMS channel + `order_updates` pref |
| Guest receipt email | **PASS** | Guest checkout flow |
| Cook new-order email gated | **FAIL** | Preference ignored (BLK-6) |
| Cook new-review email gated | **PASS** | Checks `emailNotificationsNewReview` |
| Tests for notification gating | **PARTIAL** | `client-notification-preferences.test.ts`; no test for `deliverOrderClientUpdate` or cook new-order gate |

---

## 18. Cross-browser & device

| Audit | Status | Evidence |
|-------|--------|----------|
| Playwright e2e in CI | **FAIL** | Not present; acknowledged in go-live doc |
| Touch target sizes | **PARTIAL** | Primary buttons adequate; some icon-only controls small |
| iOS Safari payment flow | **NOT RUN** | Manual QA required |

---

## 19. Dead code & unused artifacts

### Orphan API routes (no frontend callers)

| Route | Notes | Recommendation |
|-------|-------|----------------|
| `GET /api/service-area` | Legacy listings model; queries `listings` by `listingId` | Remove after confirming no external links |
| `POST /api/address/geocode` | Replaced by `AddressSearchInput` / Mapbox client | Remove or rate-limit + document |
| `POST /api/checkout/customer-session` | Marked legacy; checkout uses custom wallet | Remove |

### Unused components

| Path | Notes |
|------|-------|
| `components/AddressAutocomplete/**` | Superseded by `components/AddressSearchInput`; zero imports |

### Unused / low-value lib exports

| Module | Unused exports |
|--------|----------------|
| `lib/stripe-subscriptions.ts` | `createStripeSubscription`, `cancelStripeSubscription`, price/product helpers — only `getOrCreateStripeCustomer` used |
| `lib/storage/listings.ts` | `deleteListingPhoto` (tests only); `uploadListingPhoto` misnamed, used for dish photos |

### Duplicate / stub schema files

| File | Issue |
|------|-------|
| `db/schema/user_preferences.ts` | Duplicate of `preferences.ts`; not exported from `index.ts` |
| `db/schema/users.ts` | Stub comment only |

### Removed route trees (confirmed absent — good)

- `app/api/business/listings/**` → migrated to `business/dishes/**`
- `app/api/listings/**`, `app/api/subscriptions/**`, `app/api/favourites/listings/**`

---

## 20. Unused database tables & fields

**Method:** Schema read + grep for Drizzle export names in `lib/` and `app/api/` (excluding migrations).

### Tables — verdict summary

| Table | Verdict | Notes |
|-------|---------|-------|
| `user`, `session`, `account`, `verification` | **ACTIVE** | Better Auth + app |
| `cook_profiles`, `dishes`, `dish_*`, `orders`, `order_dishes`, `order_payments` | **ACTIVE** | Core launch model |
| `cook_pickup_windows`, `cook_search_index`, `followed_cooks` | **ACTIVE** | |
| `conversations`, `messages`, `cook_notification_reads` | **ACTIVE** | Inbox |
| `user_preferences`, `user_addresses`, `legal_acceptances`, `tags` | **ACTIVE** | |
| `waitlist`, `rate_limit_log`, `stripe_webhook_events`, `cook_payouts` | **ACTIVE** | |
| `cook_applications`, `setup_tokens` | **ACTIVE** | Onboarding |
| `cook_certifications` | **ACTIVE** | Setup wizard |
| `admin_user`, `admin_account`, `admin_session`, `admin_verification` | **UNUSED** | Schema only; no admin app |
| `saved_listings` | **UNUSED** | Replaced by `followed_cooks` |
| `listing_promotions`, `listing_bundles` | **UNUSED** | Superseded by `dish_promotions` |
| `cook_agreements` | **UNUSED** | Never read/written |
| `listings`, `listing_dishes` | **SUSPECT** | No `insert(listings)`; joins for legacy `orders.listing_id` + orphan `service-area` route |
| `listing_subscription_tiers`, `client_subscriptions` | **SUSPECT** | Webhook-only; no subscribe UI/API |
| `cook_search_index` | **ACTIVE** | Raw SQL in `lib/search/query.ts` |

### Deprecated columns still in schema (runtime reads)

| Table.Column | Schema note | Still used by |
|--------------|-------------|---------------|
| `orders.listing_id` | Deprecated | ~12 cook dashboard/inbox routes (`leftJoin` for historical title) |
| `orders.subscription_id` | Subscriptions removed for launch | Stripe webhook `invoice.payment_succeeded` only |
| `orders.quantity`, `orders.unit_price`, `orders.promotion_id` | Deprecated single-line pricing | Cook order APIs still return fields (often null) |
| `reviews.listing_id` | Deprecated | Reviews API optional filter |
| `listings.subscription_interval`, `commitment_periods` | Marked legacy in schema | Zero app refs |

### Enums with no app usage

- `listing_type`, `listing_status`, `subscription_interval`, `subscription_status` — schema/webhook only

### Cleanup recommendation (post-launch migration)

1. Remove subscription webhook handler + 4 listing/subscription tables after data migration.
2. Drop `saved_listings`, `listing_promotions`, `listing_bundles`, `cook_agreements`.
3. Null out or migrate `orders.listing_id`, `orders.subscription_id`, deprecated price columns; update dashboard to dish-only shape.
4. Delete orphan routes and `AddressAutocomplete` component.

---

## 21. Test coverage gaps (critical paths)

| Path | Tests exist? |
|------|----------------|
| Order placement + pricing | **YES** — `orders.test.ts`, `api/orders/pricing.test.ts` |
| Stripe webhooks | **YES** — `webhooks-stripe.test.ts` |
| Guest checkout | **YES** — `guest-checkout-api.test.ts` |
| Auth / OTP | **YES** — multiple `auth-*.test.ts`, `client-*-otp.test.ts` |
| `GET /api/health` | **NO** |
| `GET /api/cron/reconcile` | **NO** |
| `lib/order-client-notifications.ts` | **NO** |
| `lib/sms.ts` | **NO** |
| Cook `emailNotificationsNewOrder` gating | **NO** (and feature broken) |
| Mapbox geocode/distance routes | **NO** |

---

## 22. Prioritized remediation backlog

### P0 — before launch

1. Rate-limit `address/geocode`, `delivery/distance`, `business/application` (BLK-1, BLK-2).
2. Harden `/api/internal/*` at network layer (BLK-3).
3. Verify Resend DNS + send test order emails to Gmail/Outlook (BLK-5).
4. Promote `MAPBOX_SECRET_TOKEN` to critical if delivery enabled (BLK-4).
5. Gate cook new-order email on preference (BLK-6).

### P1 — launch week

1. Handle Stripe `account.updated` webhook (BLK-8).
2. Rate-limit `reset-password`, `confirm-payment`.
3. External uptime monitor + Neon PITR (BLK-9, BLK-10).
4. Em-dash sweep on user-facing strings.
5. Remove or hide `smsNotificationsNewOrder` toggle until implemented.

### P2 — first month

1. Dead code removal (orphan routes, `AddressAutocomplete`, subscription lib).
2. DB migration to drop unused tables/columns.
3. Migrate browse images to `next/image`.
4. Tests for health, cron, notification gating.
5. Load test (k6) per go-live B4.
6. Lock platform fee copy site-wide.

---

## Verification baseline (this audit)

```text
Date: 2026-06-22
pnpm test:run → 97 files, 689 tests passed
Static review only — no production penetration test, no Lighthouse run
```

---

## Related documents

- `docs/SECURITY_AUDIT_HANDOFF.md` — prior security findings (most Critical/High marked fixed)
- `docs/go-live-readiness.md` — operational launch-day checklist
- `docs/superpowers/specs/2026-06-17-listings-to-dishes-redesign.md` — migration context for legacy schema

---

*Findings dated 2026-06-22. Code-level remediations applied 2026-06-23 — see "Remediation status" near the top. Ops items (DNS, PITR, monitoring, env provisioning) remain outstanding.*
