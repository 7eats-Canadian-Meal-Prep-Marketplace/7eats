# Go-Live Readiness — Remaining Items

**Date:** 2026-06-18
**Scope:** Items from the pre-launch health check that were **not** code-only fixes. Everything in "Bucket A" (rate limiting, env validation, DB indexes, client receipt email, health endpoint, refund-policy page, empty/error-state verification, secret-leak audit, reconciliation job) is **done and committed** on the `listing-flow` branch.

**Bottom line:** **None of the items below are hard blockers that must delay launch.** They are operational hardening. The two worth doing on launch day are wiring the **Sentry DSN** (the SDK is already integrated) and switching `DATABASE_URL` to the **Neon pooled endpoint**. Everything else can land in the first week post-launch without customer-facing risk.

---

## Bucket B — code is done; you flip one switch

### B1. Error monitoring (Sentry)
- **Status:** SDK is **already integrated** — `instrumentation.ts` imports `@sentry/nextjs`, loads `sentry.server.config` / `sentry.edge.config`, and exports `onRequestError = Sentry.captureRequestError`. A client config is also present.
- **You do:** create the Sentry project and set the `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` env vars (and source-map upload token if you want stack traces). Verify a test error appears in the dashboard.
- **Delays launch?** **No** — but do it on launch day. Without the DSN you launch blind to runtime errors; with it, it's a 10-minute setup.

### B2. Payment reconciliation cron
- **Status:** Route is **built** — `GET /api/cron/reconcile`, protected by a `CRON_SECRET` bearer token. Each daily run:
  1. **Abandoned checkout cleanup** — cancels unpaid `pending` orders (and their Stripe PIs) older than 30 minutes.
  2. **Stuck authorized payments** — flags `authorized` payments older than 48h and emails `RESEND_TEAM_EMAIL` a summary.
- **Schedule:** one daily job in `vercel.json` (`0 9 * * *`). **Vercel Hobby only allows daily crons**, so abandoned-checkout cleanup is merged here instead of a separate 15-minute job. For more frequent sweeps later, call `GET /api/cron/abandoned-checkouts` manually or from an external scheduler (e.g. GitHub Actions), or upgrade to Vercel Pro.
- **You do:** set `CRON_SECRET`. Cron entry is already in `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/reconcile", "schedule": "0 9 * * *" }] }
  ```
  (Vercel Cron sends the `Authorization: Bearer <CRON_SECRET>` header automatically when `CRON_SECRET` is set in project env.)
- **Delays launch?** **No.** At pilot volume you can run it manually for the first week. Useful before scaling.

### B3. Connection pooling (Neon)
- **Status:** The app uses `@neondatabase/serverless` (HTTP) for most queries and a node-postgres pool (`dbPool`) for transactions. Serverless functions can exhaust direct connections under load.
- **You do:** confirm `DATABASE_URL` points at the Neon **pooled** connection string (the `-pooler` host), not the direct one. No code change needed.
- **Delays launch?** **Low risk at pilot scale, but do it before any real traffic** — it's a one-line env change and prevents "too many connections" under concurrency.

### B4. Load test
- **Status:** Not written yet (I can provide a k6/artillery script for the browse → menu → checkout → order path, including a limited-promotion contention scenario).
- **You do:** run it against a staging deploy and watch p95 latency, error rate, and DB connections.
- **Delays launch?** **No** — but running it once before opening to 1000 users is strongly recommended, specifically to validate the promotion `FOR UPDATE` lock + pooler under concurrent checkout.

---

## Bucket C — operational / infrastructure (yours)

### C1. Neon backups / PITR
- **You do:** confirm point-in-time recovery is enabled in the Neon dashboard and you know the retention window.
- **Delays launch?** **No, but non-negotiable before real customer data.** It's a dashboard toggle, not code. Do it before launch; it doesn't block the build.

### C2. Uptime monitor + alert routing
- **You do:** point an external monitor (Better Uptime, Pingdom, etc.) at `GET /api/health` (already built — returns 503 if the DB is unreachable) and route alerts to your phone/Slack.
- **Delays launch?** **No.** Add in the first day or two.

### C3. Dispute / refund runbook
- **You do:** decide who handles Stripe disputes, the SLA for responding, and the evidence template. The refund-policy page and the `order_payments` history already give you the data; this is process, not code.
- **Delays launch?** **No.** But have a basic answer to "a customer charged back — who does what?" before you take real money.

---

## Known accepted gaps (documented, not blocking)

- **Platform fee:** **7.5%** per order (`cook_profiles.platform_fee_pct` default). Customer-facing FAQ and cook onboarding copy reflect this rate.
- **Abandoned orders:** unpaid checkouts are cancelled by the daily reconcile job (B2) once they are older than 30 minutes; worst case they linger until the next 9:00 UTC run. Stuck *authorized* payments are surfaced in the same job. Stripe webhooks also clean up when a PI is cancelled. For sub-daily cleanup on Hobby, trigger `GET /api/cron/abandoned-checkouts` manually or use an external scheduler.
- **Delivery out-of-zone at checkout:** the cart shows "Outside delivery zone," but checkout currently still allows submitting; the server snapshots a 0 fee rather than hard-blocking. Tighten if delivery becomes common.
- **Deep Stripe↔DB amount reconciliation:** B2 checks DB-side staleness; per-PI amount/status verification against the Stripe API can be layered onto the same cron later.
- **Playwright e2e:** not run in-session (you're handling e2e). Build + 510 unit/integration tests + lint are green.

---

## Launch-day checklist (the realistic minimum)

1. Set `SENTRY_DSN` (B1) and confirm errors flow in.
2. Point `DATABASE_URL` at the Neon **pooled** endpoint (B3).
3. Enable Neon PITR (C1).
4. Set `CRON_SECRET` + the reconcile schedule (B2) — or commit to running it manually week one.
5. Point an uptime monitor at `/api/health` (C2).

Items 1–3 are the ones I'd genuinely not launch without. 4–5 can slip a few days.
