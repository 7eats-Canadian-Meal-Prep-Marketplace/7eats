# External Services, Env Variables & Setup Steps

Everything you need to wire up before the supply-side onboarding flow works end-to-end.

---

## 1. Neon (Database)

**What it's used for:** Primary database + RLS auth helpers.

**What you need:**
- Your existing `DATABASE_URL` is all you need. It connects as the Neon project owner (table owner), which bypasses RLS by default in Postgres. No second connection string or special role required for server-side writes.

**One-time setup:** None beyond what you already have.

**Env variables:**
```
DATABASE_URL=postgresql://...   # existing — covers everything server-side
```

---

## 2. Better Auth (Neon Auth)

**What it's used for:** Password hashing, session management, JWT + refresh tokens for cook accounts.

**What you need:** No external account — the package runs entirely against your Neon database. It creates its own `neon_auth` schema on first run.

**One-time setup:**
- Install: `pnpm add better-auth`
- Initialize in `lib/auth.ts` with the Neon/Postgres adapter pointing at `DATABASE_URL`
- Mount catch-all handler at `app/api/auth/[...all]/route.ts`
- Better Auth will create the `neon_auth.user`, `neon_auth.session`, and `neon_auth.jwks` tables automatically on first start

**Env variables:**
```
BETTER_AUTH_SECRET=             # random 32-byte hex — signs sessions
BETTER_AUTH_URL=                # your app's base URL, e.g. https://7eats.ca
```

---

## 3. Resend (Email)

**What it's used for:** Two emails — internal team notification when an application is submitted (M1), and the magic link setup email sent to the approved cook (M2).

**What you need:**
- Create an account at resend.com
- Verify your sending domain (e.g. `7eats.ca`) — add the DNS records Resend gives you
- Create an API key with "Send" permission

**Env variables:**
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@7eats.ca   # must match your verified domain
RESEND_TEAM_EMAIL=ops@7eats.ca       # internal recipient for application notifications
```

---

## 4. Twilio Verify (Phone OTP)

**What it's used for:** Sending and verifying the 6-digit SMS OTP during phone verification (M5). Twilio Verify manages code generation, delivery, and expiry internally — you do not store OTP codes in your database.

**What you need:**
- Create an account at twilio.com
- In the Twilio console: go to **Verify** → **Services** → create a new service (e.g. "7eats Cook Verification")
- Note the **Service SID** (starts with `VA...`)
- From your account dashboard: note the **Account SID** and **Auth Token**

**Mocking during development:** Twilio Verify supports test credentials — any number matching `+15005550006` is always approved without sending a real SMS. Or stub the send/verify server actions to always return success with a hardcoded code (`123456`). Remove stubs before staging.

**Env variables:**
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
```

---

## 5. Stripe Connect (Payments)

**What it's used for:** Onboarding cooks as Stripe Express accounts so they can receive payouts (M7, step 4).

**What you need:**
- Create an account at stripe.com
- In the Stripe dashboard: enable **Connect** → set your platform name and branding
- Get your **Secret key** (server-side only) and **Publishable key** (client-safe)
- Set up a **Webhook endpoint** for Connect events (at minimum: `account.updated`) so you know when a cook completes or loses Stripe verification. Endpoint: `https://your-domain.com/api/webhooks/stripe`
- Note the **Webhook signing secret** after creating the endpoint

**Mocking during development:** Stripe provides test mode keys (`sk_test_...`). In test mode, use Stripe's test OAuth flow — no real accounts are created. Or stub the server action to return `acct_test_mock` and always report `charges_enabled: true`. Remove stubs before staging.

**Env variables:**
```
STRIPE_SECRET_KEY=sk_live_...        # sk_test_... in development
STRIPE_PUBLISHABLE_KEY=pk_live_...   # pk_test_... in development
STRIPE_WEBHOOK_SECRET=whsec_...      # from the Stripe webhook dashboard
```

---

## 6. Cloudflare R2 (File Storage)

**What it's used for:** Profile photo uploads (M6 step 1) and food handler cert uploads (M7 step 3). Already partially wired.

**What you need:** Already configured. Confirm the following buckets exist and the env vars are set:
- Public bucket for avatars → `R2_PUBLIC_BUCKET_URL_AVATARS`
- Private bucket for certs → accessed via signed URLs, no public URL needed

**Env variables (already in .env.example):**
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BUCKET_URL_LISTINGS=
R2_PUBLIC_BUCKET_URL_AVATARS=
```

---

## 7. App-level secrets

These don't belong to any external service but are required for the app to run.

```
COOKIE_SECRET=          # signs short-lived cookies (application_submitted, pending_phone)
                        # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

INTERNAL_API_KEY=       # protects /api/internal/issue-link and /api/internal/reissue-link
                        # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

NEXT_PUBLIC_APP_URL=    # base URL for building magic links and Stripe return URLs
                        # e.g. https://7eats.ca in production, http://localhost:3000 locally
```

---

## Full env variable reference

| Variable | Required | Service | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | Neon | Existing — table owner, bypasses RLS server-side |
| `BETTER_AUTH_SECRET` | Yes | Better Auth | 32-byte random hex |
| `BETTER_AUTH_URL` | Yes | Better Auth | App base URL |
| `RESEND_API_KEY` | Yes | Resend | |
| `RESEND_FROM_EMAIL` | Yes | Resend | Verified domain address |
| `RESEND_TEAM_EMAIL` | Yes | Resend | Internal notification recipient |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio | |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio | |
| `TWILIO_VERIFY_SERVICE_SID` | Yes | Twilio | |
| `STRIPE_SECRET_KEY` | Yes | Stripe | Server-side only |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe | Client-safe |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe | From webhook dashboard |
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2 | Existing |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare R2 | Existing |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare R2 | Existing |
| `R2_PUBLIC_BUCKET_URL_LISTINGS` | Yes | Cloudflare R2 | Existing |
| `R2_PUBLIC_BUCKET_URL_AVATARS` | Yes | Cloudflare R2 | Existing |
| `COOKIE_SECRET` | Yes | App | 32-byte random hex |
| `INTERNAL_API_KEY` | Yes | App | 32-byte random hex |
| `NEXT_PUBLIC_APP_URL` | Yes | App | Base URL |
| `RATE_LIMIT_WINDOW_MINUTES` | No | App | Default: 60 |
| `RATE_LIMIT_MAX_ATTEMPTS` | No | App | Default: 3 |
