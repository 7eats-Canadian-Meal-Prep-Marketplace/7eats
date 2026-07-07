This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## CI/CD

GitHub Actions uses two Vercel workflows:

- `.github/workflows/preview.yaml` runs on pushes to non-`main` branches and creates Vercel Preview deployments.
- `.github/workflows/production.yaml` runs on pushes to `main` and creates Vercel Production deployments.

Each workflow installs dependencies with `pnpm install --frozen-lockfile`, then runs `pnpm lint` and `pnpm test:run` from this `my-app` directory. The Vercel CLI then pulls the matching Vercel environment variables and runs `vercel build` before deploying the prebuilt output.

Preview deployments only run after branch pushes, because GitHub does not expose repository secrets to forked pull requests.

Configure these GitHub repository secrets before expecting deployments to run:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Keep `.env.local` local-only. Do not commit local environment files or copy their values into workflow files; use GitHub secrets and Vercel project environment variables for CI/CD.

---

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

---

## Supply-side auth

Cook accounts are created through a team-gated onboarding flow, not open self-registration.

```
/business/application
  Cook submits a two-step application form (kitchen info + contact info).
  Application written to the database with status "pending_review".
  Ops team is notified by email.

--- team reviews, calls the cook, then issues a magic link ---

Approving an application and (re)issuing the setup link is handled by the
admin panel in the separate 7eats-admin repo, which writes directly to the
shared database and emails the cook a 3-day link to
/business-auth/setup/create-password?token=.

/business-auth/setup/create-password?token=
  Token validated server-side (existence, expiry, not yet consumed).
  Cook sets a password. Account created via Better Auth; session started.
  Token consumed (one-time use). Redirects to verify-phone.

/business-auth/setup/verify-phone
  Cook enters their phone number. OTP sent via Twilio Verify.
  On success: phone_verified flagged true. Redirects to the onboarding wizard.

/business-auth/setup/onboarding?step=1–4
  Four-step wizard. Progress tracked in the database (currentSetupStep).
  Step 1: cook profile (display name, photo, bio, cuisine types).
  Step 2: operations (pickup address, days, hours, lead time, capacity).
  Step 3: compliance (food handler certificate details and optional photo).
  Step 4: payment (Stripe Connect mock) + Terms of Service acceptance.
  Completing step 4 sets setup_complete = true.

/business/dashboard
  Cook's operator portal. Accessible after completing steps 1 & 2.
  Steps 3 & 4 can be completed later from the dashboard.
```

Returning cooks sign in at `/business-auth/login`. Sessions are managed by Better Auth (7-day sliding expiry, HTTP-only cookie). Forgot-password flow is not yet implemented.

When `RESEND_API_KEY` is not set (local dev), the magic link is printed to the `pnpm dev` terminal instead of being emailed.

### Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | Secret used by Better Auth to sign sessions |
| `NEXT_PUBLIC_APP_URL` | Base URL for magic links (e.g. `https://7eats.ca`) |
| `COOKIE_SECRET` | HMAC key for signing `application_submitted` and `pending_phone` cookies |
| `RESEND_API_KEY` | Resend API key for transactional email (optional in dev — link logged to terminal) |
| `RESEND_FROM_EMAIL` | From address for outbound email |
| `RESEND_TEAM_EMAIL` | Internal address that receives new application notifications |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for OTP |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify service SID |

For full flow detail see `docs/ONBOARDING.md`.
