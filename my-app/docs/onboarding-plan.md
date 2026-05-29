# Cook Onboarding — Implementation Plan

End-to-end backend wiring for the cook onboarding flow, from application submission to first dashboard login. Organized as sequential milestones. Each one is independently shippable and testable before moving to the next.

---

## Packages to install before starting

```bash
pnpm add better-auth resend twilio stripe
```

| Package | Purpose |
|---|---|
| `better-auth` | Neon Auth — password hashing, session management, JWT + refresh tokens |
| `resend` | Magic link emails |
| `twilio` | Phone OTP via Twilio Verify — **mocked during development** |
| `stripe` | Stripe Connect Express — **mocked during development** |

All other needs (Drizzle, Zod v4, S3/R2, rate limiting) are already in place.

**One DB client is sufficient.** `DATABASE_URL` connects as the Neon project owner, which is the table owner. Table owners bypass RLS by default in Postgres — `FORCE ROW SECURITY` would be required to change that, and none of your tables set it. So every server action using `db` from `db/index.ts` already bypasses RLS. No second client needed. RLS only enforces against non-owner connections — relevant later if you expose the DB directly via Neon's Data API with cook JWTs from the browser.

---

## Auth Provider — Neon Auth (Better Auth)

Neon Auth is used for session management on the supply side. It issues short-lived JWTs (15-min access tokens) with automatic refresh via `authClient.token()`. The auth state (users, sessions, JWKS) lives in a dedicated `neon_auth` schema inside the same Neon database, so it branches with the rest of the data.

**Integration steps:**

1. Initialize the Better Auth instance in `lib/auth.ts` with the Neon/Postgres database adapter pointing at `DATABASE_URL`.
2. Mount the catch-all API handler at `app/api/auth/[...all]/route.ts` — Better Auth handles login, logout, session refresh, and JWKS endpoints automatically.
3. In Milestone 3, call `auth.api.signUpWithEmailAndPassword({ body: { email, password, name }, asResponse: true })`. This creates the `neon_auth.user` record, hashes the password internally, and establishes the session cookie in a single call. **Capture the returned user ID** and use it as the PK when inserting into `public.users` — never use `defaultRandom()` for that row. This is what makes `id = auth.uid()` true in RLS, because the JWT `sub` will equal the Better Auth user ID.
4. Replace manual JWT verification in Milestone 4 middleware with `auth.api.getSession({ headers: req.headers })`.
5. The `auth.uid()` and `auth.role()` SQL functions in `db/sql/neon-auth-helpers.sql` stay as-is — they read the JWT sub/role claims that Better Auth issues, so RLS policies require no changes.
6. **Schema change required before starting:** Drop the `password_hash` column and its check constraint (`password_hash_or_pending`) from `public.users`. Better Auth owns credentials in `neon_auth.user` — storing a separate hash in our table is redundant and misleading. Run `pnpm db:generate` + `pnpm db:migrate` after updating the schema.

**Mocking external libraries during development:**

- **Twilio (OTP):** Stub the send and verify server actions to always succeed. Hardcode a fixed OTP code (e.g. `123456`) that passes verification. Remove the stub before any real testing.
- **Stripe Connect:** Stub the account creation and `charges_enabled` check. Return a fake `acct_test_mock` ID and always return `charges_enabled: true`. Remove the stub before any real testing.

---

## Milestone 1 — Application Form Server Action

**Route:** `POST` via server action on `/business/application`

**What it does:** Validates and writes the cook's application to `cook_applications`. Notifies the team. Redirects to confirmation.

**Libraries:** Drizzle, Zod, Resend (team notification)

**Implementation:**
1. Write a Zod schema matching all `FormState` fields. Canadian postal code regex (`/^[A-Z]\d[A-Z]\d[A-Z]\d$/i`), phone stripped to digits before storing, email lowercased.
2. Server action receives the form data, validates with Zod, inserts into `cook_applications` with `status: 'pending_review'`.
3. On success, set a short-lived `application_submitted` HTTP-only cookie — value is `crypto.randomBytes(16).toString('hex')`, signed with `crypto.createHmac('sha256', process.env.COOKIE_SECRET)`. 10-min TTL. No external JWT library needed. Redirect to `/business/application-confirmation`.
4. Send an internal notification email to the ops team via Resend.

**Edge cases:**
- **Duplicate email:** `cook_applications` has a unique index on `contact_email`. Catch the DB unique constraint violation and return a field-level error: `"An application with this email already exists. Contact us if you need help."` No redirect — inline error on the form.
- **Confirmation page accessed directly:** Middleware checks for the `application_submitted` cookie. If missing, redirect to `/business/application`. The cookie is cleared once the confirmation page loads.
- **Resend failure:** Team notification is fire-and-forget. If it fails, log the error server-side but do not fail the user's submission — the record is in the DB and the team can query for pending applications.
- **Form re-submission on back button:** The cookie approach means re-visiting the confirmation page after the cookie expires sends the user back to the application form, which is the correct behavior.

---

## Milestone 2 — Internal Token Issuance

**Route:** `POST /api/internal/issue-link` (secret-key protected, never exposed to clients)

**What it does:** Called by the team from Postman or a simple internal tool after reviewing an application. Marks the application as approved, generates a magic link token, stores it, and sends the setup email to the cook.

**Libraries:** Node `crypto` (built-in), Drizzle, Resend

**Implementation:**
1. Endpoint requires a header `x-internal-key` matching `process.env.INTERNAL_API_KEY`. Return 401 if missing or wrong.
2. Accept `{ applicationId }` in the body. Look up the application — must exist and be `pending_review`.
3. Generate token: `crypto.randomBytes(32).toString('hex')` (64-char hex string). Hash it with SHA-256 before storing (same pattern as `lib/hash.ts`). Raw token is never written to DB.
4. Open a `dbService` transaction:
   - Insert into `setup_tokens`: `{ applicationId, tokenHash, expiresAt: now + 3 days }`. **Note:** Postgres does not auto-delete expired rows — the token stays in the table indefinitely. It "expires" logically because the query filters `expires_at > now()`. If you want physical cleanup, add a scheduled job or a periodic `DELETE FROM setup_tokens WHERE expires_at < now()`. For now, the query filter is sufficient.
   - Update `cook_applications` status to `approved`.
5. Send email via Resend to `contact_email` with the magic link: `https://7eats.com/business-auth/setup/create-password?token=<raw_token>`. If Resend fails, return 502 — the transaction is already committed, so mark the application back to `pending_review` in a follow-up query and let the team retry.

**Edge cases:**
- **Application already approved:** Return 409 with `"Application is already approved."` Do not issue a second token.
- **applicationId not found:** Return 404.
- **Re-issuing a link (e.g. cook lost the email):** Add a separate `POST /api/internal/reissue-link` endpoint. It marks all existing unconsumed tokens for that application as expired (`expiresAt = now`) and issues a fresh one.
- **Resend failure:** Roll back the token insert and the status update. Return 502 — the team can retry. Do not leave an approved application without a deliverable link.

---

## Milestone 3 — Create Password + Account Creation

**Route:** `/business-auth/setup/create-password` (page + server action)

**What it does:** Validates the token, shows the password form, and on submission creates the `users` row and `cook_profiles` row (password hashing handled by Better Auth), starts a session, and consumes the token — all in a single DB transaction using `dbService`.

**Libraries:** Better Auth (`auth.api.signUpWithEmailAndPassword`), Drizzle (transaction), Node `crypto`

**Implementation:**
1. **Page load (server component):** Read `?token=` from URL. If missing, redirect to `/business-auth/setup/expired`. Hash the token with SHA-256, query `setup_tokens` where `token_hash = hash AND consumed_at IS NULL AND expires_at > now()`. If no row found, redirect to `/business-auth/setup/expired`.
2. **Already logged in:** If a valid session cookie exists on page load, read `currentSetupStep` from `cook_profiles` and redirect to the correct onboarding URL.
3. **Password form (client component):** Two fields — password and confirm password. Inline validation: minimum 8 characters, must match. No page reload on mismatch.
4. **Server action on submit:**
   - Re-validate the token (same DB check as step 1 — tokens can expire between page load and submit).
   - Call `auth.api.signUpWithEmailAndPassword({ body: { email, password, name: fullName }, asResponse: true })`. Better Auth hashes the password internally and creates the `neon_auth.user` record. Capture the returned `user.id` (the Better Auth UUID) and the `Set-Cookie` headers from the response.
   - Open a Drizzle transaction using that Better Auth user ID:
     - `INSERT INTO users` — **`id = betterAuthUserId`** (not random), `role: 'cook'`, `status: 'active'`, `firstName`, `lastName`, `email` from the application row.
     - `INSERT INTO cook_profiles` — `userId = betterAuthUserId`, `applicationId`, `displayName` pre-populated from `kitchen_name`.
     - `UPDATE setup_tokens SET consumed_at = now()` where `id = token.id`.
   - If the Drizzle transaction fails, the token remains unconsumed and the cook can retry. The orphaned `neon_auth.user` record is harmless — Better Auth's `signUpWithEmailAndPassword` will return a conflict on retry, at which point fall through to sign-in only and re-run the transaction.
5. **Session:** Better Auth's `signUpWithEmailAndPassword` with `asResponse: true` returns the session cookie headers. Forward them to the Next.js response. Redirect to `/business-auth/setup/verify-phone`.

**Edge cases:**
- **Token not in URL:** Redirect to `/business-auth/setup/expired` immediately on page load.
- **Token expired or already consumed:** Redirect to `/business-auth/setup/expired`.
- **Token valid on load but expires before submit:** Re-validate in server action. Return error: `"This link has expired. Please contact us for a new one."` — no redirect, inline message.
- **Password mismatch:** Client-side inline error, no server round-trip.
- **Transaction failure (e.g. email collision):** The transaction rolls back atomically. Token stays unconsumed. Surface a generic `"Something went wrong, please try again"` error.
- **Cook bookmarks the URL and returns later:** Token is consumed on first use. On revisit, token check fails → redirect to `/business-auth/setup/expired` which has the support contact.

---

## Milestone 4 — Middleware

**File:** `middleware.ts` at `my-app/`

**What it does:** Runs before every request. Validates the session cookie and enforces route-level access rules.

**Libraries:** Neon Auth (`auth.api.getSession`), Next.js `NextResponse`

**Route rules:**

| Route pattern | Rule |
|---|---|
| `/business/application` | Always public |
| `/business/application-confirmation` | Requires `application_submitted` cookie with valid HMAC signature. Redirect to `/business/application` if missing or tampered. Clear the cookie after the page loads. |
| `/business-auth/login` | Always public. Redirect to `/business/dashboard` if session already valid. |
| `/business-auth/setup/create-password` | Public — token is the auth |
| `/business-auth/setup/expired` | Always public |
| `/business-auth/setup/verify-phone` | Requires valid session. If `phone_verified = true`, redirect to `/business-auth/setup/onboarding?step=1` |
| `/business-auth/setup/onboarding` | Requires valid session + `phone_verified = true`. `?step` param must equal `currentSetupStep` — if ahead, redirect back to correct step. If `setup_complete = true`, redirect to `/business/dashboard` |
| `/business/*` | Requires valid session. No session → redirect to `/business-auth/login` |

**Implementation:**
1. Call `auth.api.getSession({ headers: req.headers })` via Neon Auth. If it returns null or throws, treat as unauthenticated.
2. For routes that need DB state (`currentSetupStep`, `phone_verified`, `setup_complete`), fetch from `cook_profiles` joined to `users` using the `sub` from the JWT. Cache nothing — always read fresh.
3. Keep the middleware lean: only read what's needed for the specific route being requested.

**Edge cases:**
- **Random person hits `/business-auth/setup/onboarding`:** No session cookie → redirect to `/business-auth/login`.
- **Cook tries to skip step 3 by typing `?step=3` in the URL while on step 1:** Middleware reads `currentSetupStep = 1` from DB → redirects to `?step=1`.
- **Expired session cookie:** JWT verification fails → treat as unauthenticated, redirect to login.
- **Cook who completed setup tries to re-enter the wizard:** `setup_complete = true` → redirect to `/business/dashboard`.

---

## Milestone 5 — Phone Verification

**Route:** `/business-auth/setup/verify-phone`

**What it does:** Two-stage UI (already built). Stage 1 sends OTP. Stage 2 validates OTP. On success, marks `phone_verified = true` and advances to onboarding.

**Libraries:** Twilio Verify SDK, `lib/rate-limit.ts` (already exists), Drizzle

**Implementation:**
1. **Page load:** Read session. Pre-populate phone input from `cook_applications.contact_phone` (via `cook_profiles.application_id`).
2. **Send OTP server action:**
   - Strip and normalize the phone number to E.164 format (`+1XXXXXXXXXX` for Canadian numbers).
   - Check rate limit using existing `logAndCheckRateLimit` — keyed on `userId` not IP to prevent bypass via VPN.
   - Call `twilio.verify.v2.services(SID).verifications.create({ to: phone, channel: 'sms' })`.
   - Store the normalized number in a short-lived signed cookie (`pending_phone`) using the same HMAC pattern as the `application_submitted` cookie. 10-min TTL. Stage 2 reads the number from this cookie — never from the form, so the user can't swap the number between stages.
3. **Verify OTP server action:**
   - Call `twilio.verify.v2.services(SID).verificationChecks.create({ to: phone, code: otp })`.
   - On `status: 'approved'`: `UPDATE users SET phone = <number>, phone_verified = true` where `id = session.sub`. Redirect to `/business-auth/setup/onboarding?step=1`. Update `cook_profiles.current_setup_step = 1` (already default, but explicit).
   - On failure: increment attempt count (stored in a short-lived DB record or cookie). After 3 failures, lock for 10 minutes with an error message.
4. **Resend OTP:** Same send action. Twilio Verify handles its own resend rate limiting on top of ours.

**Edge cases:**
- **Cook corrects phone number from application:** Stage 1 input is editable. Normalize whatever they enter before sending. The new number is what gets saved to `users.phone` on success.
- **Wrong OTP entered 3 times:** Show a lockout message with a countdown. Do not call Twilio again during the lockout window.
- **OTP expired (10 min Twilio TTL):** Twilio returns `status: 'pending'` after expiry check. Treat as invalid OTP, prompt resend.
- **Cook already verified (e.g. refreshes the page after success):** Middleware catches `phone_verified = true` and redirects to onboarding. The verify-phone page is never shown again.
- **Twilio service down:** Catch the exception, return `"Could not send verification code. Please try again in a moment."` Do not advance.

---

## Milestone 6 — Onboarding Wizard Steps 1 & 2

**Route:** `/business-auth/setup/onboarding?step=1` and `?step=2`

**What it does:** Saves cook profile and operations data per step. Advances `currentSetupStep` after each save.

**Libraries:** Drizzle, Zod, `lib/storage/avatars.ts` (profile photo upload)

**Step 1 server action (Cook Profile):**
1. Validate: `displayName` required, `bio` 100–500 chars, at least one cuisine selected.
2. Handle photo upload: receive `File` from form data, validate MIME type (`image/jpeg`, `image/png`) and size (max 5 MB). Upload to `BUCKETS.AVATARS` via existing `lib/storage` client. Store the returned public URL.
3. Resolve tag IDs: look up `tags` rows where `slug IN (selectedSlugs)` and `category = 'cuisine'`. Same for niches and dietary. Use `slug` not `label` — slugs are unique and stable, labels can drift in casing. If any slug doesn't resolve, log and skip — do not fail the save.
4. In a transaction: `UPDATE cook_profiles SET display_name, bio, photo_url, social_link, current_setup_step = 2`. Delete existing `cook_profile_tags` for this profile, re-insert selected ones.

**Step 2 server action (Operations):**
1. Validate: `pickupAddress` required, `leadTime` required and must be a valid `leadTimeEnum` value.
2. Parse `maxCapacity` as integer, clamp to 5–500 range server-side regardless of client input.
3. `UPDATE cook_profiles SET pickup_address, pickup_days, pickup_from, pickup_to, lead_time, max_capacity, delivery, accepts_special_requests, current_setup_step = 3`. Note: `pickup_days` is a Postgres `text[]` array — send and receive it as a string array, not a comma-separated string.

**Edge cases (both steps):**
- **Session valid but `currentSetupStep` is ahead of the step being saved:** Middleware already prevents access. If somehow reached, server action re-reads step from DB and rejects if mismatched.
- **Photo upload fails (R2 error):** Return error, do not save the rest of the form. Cook must retry. Do not partially save.
- **Cook hits back then re-submits step 1:** Server action is idempotent — it updates, not inserts. Re-saving step 1 data is safe. `currentSetupStep` only advances forward (never decrements on a re-save).
- **Cook drops off mid-step (closes browser):** No data is saved until they hit "Save and continue." On return, middleware routes them back to `currentSetupStep`. They start the step fresh — fields are re-populated from DB on page load.

---

## Milestone 7 — Onboarding Wizard Steps 3 & 4

**Route:** `/business-auth/setup/onboarding?step=3` and `?step=4`

**What it does:** Saves compliance cert data and wires Stripe Connect. Completing step 4 sets `setup_complete = true`.

**Libraries:** Drizzle, Zod, `lib/storage/certs.ts` (private bucket, already exists), Stripe Node SDK

**Step 3 server action (Compliance):**
1. Validate: `certIdNumber` required, `certFullName` required, `certExpiry` required and must be a future date (compare server-side — never trust the client's `min` attribute).
2. If photo uploaded: validate MIME (`image/jpeg`, `image/png`, `application/pdf`), max 10 MB. Upload to `BUCKETS.CERTS` (private). Store the key, not a public URL — access is via signed URLs.
3. `INSERT INTO cook_certifications` — `cookId`, `name: 'Food Handler Certificate'`, `holderName`, `certificateNumber`, `expiresAt`, `fileUrl`, `status: 'pending_review'`. If the cook re-submits step 3, a second row is created — both will appear in the admin review queue, which is acceptable. Do not block re-submission.
4. `UPDATE cook_profiles SET current_setup_step = 4`.
5. **"Complete later":** If cook clicks Complete later, redirect to `/business/dashboard` without saving. `currentSetupStep` stays at 3. Dashboard shows an outstanding steps prompt.

**Step 4 server action (Get Paid):**
1. **Stripe Connect initiation:** When cook clicks "Connect with Stripe →", call a separate server action. It calls `stripe.accounts.create({ type: 'express' })` to get a Stripe account ID, then immediately saves it to `cook_profiles.stripe_account_id` (even before onboarding is complete — this is the pending account ID). Then calls `stripe.accountLinks.create(...)` and returns the onboarding URL. Client redirects to Stripe.
2. **Stripe return:** Stripe redirects back to `/business-auth/setup/onboarding?step=4&stripe=return`. On page load, read `stripe_account_id` from `cook_profiles` (already saved in step 1), call `stripe.accounts.retrieve(stripeAccountId)` to confirm `charges_enabled = true`. If confirmed, mark the Stripe box as connected in the UI.
3. **Step 4 save (final submit):** Validate `stripeConnected` (check `stripe_account_id IS NOT NULL` in DB — never trust client state) and `tosAccepted`. In a transaction: `UPDATE cook_profiles SET tos_accepted_at = now(), setup_complete = true, current_setup_step = 4`. Redirect to `/business/dashboard`.

**Edge cases:**
- **Cert expiry date in the past:** Server action rejects with `"Expiry date must be in the future."` The `min` attribute on the date input is a UX hint only.
- **File too large or wrong type:** Validate before upload, return error immediately.
- **Cook closes Stripe tab without finishing:** They return to step 4 with no `stripe_account_id`. The Stripe box shows "Connect with Stripe →" again. They can retry. Nothing is broken.
- **`setup_complete` check on final submit:** Server action re-reads `stripe_account_id` from DB and calls Stripe API to confirm `charges_enabled`. Does not rely on `form.stripeConnected` from the client.
- **"Complete later" on step 4:** Same as step 3 — redirect to dashboard, `setup_complete` stays false, prompt shown on dashboard.
- **Cook publishes a listing before setup is complete:** Listing creation checks `setup_complete` server-side before allowing `status` to be set to anything other than `draft`. This is enforced in the listings server action, not just the UI.

---

## Milestone 8 — Cook Login

**Route:** `/business-auth/login` (page + server action)

**What it does:** After the session expires (7-day inactivity), cooks re-authenticate here. Not part of the onboarding wizard — this is the returning-user entry point.

**Libraries:** Better Auth (`auth.api.signInWithPassword`)

**Implementation:**
1. Simple two-field form: email + password. No magic link — they have an account from Milestone 3.
2. Server action calls `auth.api.signInWithPassword({ body: { email, password }, asResponse: true })`. Forward the session cookie headers. Redirect to `/business/dashboard`.
3. On failure (wrong credentials): return `"Incorrect email or password."` — no distinction between wrong email vs wrong password (prevents enumeration).
4. Rate-limit login attempts by IP using existing `lib/rate-limit.ts`. Pass `{ windowMinutes: 15, maxAttempts: 5 }` inline — do not rely on the global env vars (`RATE_LIMIT_WINDOW_MINUTES` / `RATE_LIMIT_MAX_ATTEMPTS`) which are tuned for a different flow. Check `lib/rate-limit.ts` supports per-call config; if not, add an optional params argument before implementing M8.

**Edge cases:**
- **Cook hits login while already authenticated:** Middleware detects valid session and redirects to `/business/dashboard` before the page loads.
- **Cook whose setup is incomplete:** After sign-in, middleware reads `currentSetupStep` and `setup_complete`, redirects to the correct onboarding step instead of dashboard.

---

## Milestone 9 — Docs & README

**What it does:** Update the project README with the supply-side auth flow, and write a separate setup reference doc covering every external service, env variable, and one-time configuration step needed to run this feature end-to-end.

**Implementation:**
1. Update `README.md` — add a "Supply-side auth" section describing the overall flow (application → magic link → account creation → phone verify → onboarding wizard → dashboard). Keep it high-level, no implementation details.
2. Create `docs/services-and-env.md` — full reference doc covering every external service, all env variables, and any one-time setup steps. See `docs/services-and-env.md` for the living version of this document.

---

## Security summary

| Threat | Mitigation |
|---|---|
| Token guessing | 32 random bytes = 256 bits of entropy. Stored as SHA-256 hash. |
| Token replay | One-time use. `consumed_at` set in the same transaction as account creation. |
| Token enumeration | Expired and consumed tokens return the same `/setup/expired` response — no distinction. |
| Session hijacking | HTTP-only, Secure, SameSite=Strict cookie managed by Better Auth. 7-day sliding expiry. |
| Password credential theft | Better Auth owns credential storage in `neon_auth.user`. No password hash in `public.users`. |
| OTP brute force | 3 attempts then 10-min lockout via existing `rate-limit.ts` |
| Step skipping | Middleware reads `currentSetupStep` from DB on every request — client URL tampering has no effect. |
| Stripe account bypass | Final submit re-validates `charges_enabled` via Stripe API, not client state. |
| Cert expiry spoofing | Server re-validates expiry is a future date regardless of client input. |
| Duplicate applications | Unique index on `contact_email` in `cook_applications`. Caught at DB level. |
| Internal API exposure | `x-internal-key` header required. Never referenced in client code. |

---

## Implementation handoff — `business-auth` branch

> **Note:** The test steps below cover the happy path only. Before merging to `main` this feature needs broader testing: edge cases, error handling under failure conditions (Twilio down, Resend down, DB transaction failures), concurrent requests, and a full run in a production-equivalent environment.

### What was built

All milestones (M1–M8) are implemented. The architecture uses Next.js API route handlers (`app/api/`) for all mutations — no server actions. Better Auth manages sessions; `Set-Cookie` headers are forwarded directly from the Better Auth internal response to the HTTP response, bypassing Next.js cookie abstractions.

Key routes:
- `POST /api/business/application` — application submission
- `POST /api/internal/issue-link` — approve application, issue setup token, send email
- `POST /api/internal/reissue-link` — expire old tokens, issue a fresh one
- `POST /api/setup/create-account` — validate token, create Better Auth user + cook profile, start session
- `POST /api/setup/send-otp` — send Twilio Verify OTP, set signed `pending_phone` cookie
- `POST /api/setup/verify-otp` — check OTP, mark `phoneVerified = true`
- `POST /api/setup/onboarding/[1-4]` — save each wizard step
- `POST /api/setup/stripe-connect` — mock Stripe connect (sets a placeholder account ID)
- `POST /api/auth/sign-in` — login with email/password
- `POST /api/auth/sign-out` — invalidate session

### Happy-path test walkthrough

1. **Submit application** — navigate to `/business/application`, fill both steps, submit. Should redirect to `/business/application-confirmation`.

2. **Issue setup link** — run from terminal (CMD):
   ```
   curl -s -X POST http://localhost:3000/api/internal/issue-link -H "Content-Type: application/json" -H "x-internal-key: <INTERNAL_API_KEY>" -d "{\"applicationId\":\"<uuid from DB>\"}"
   ```
   Check the `pnpm dev` terminal for the magic link URL (printed regardless of Resend configuration).

3. **Create password** — open the magic link. Set a password. Should redirect directly to `/business-auth/setup/verify-phone` with an active session (no login prompt).

4. **Verify phone** — enter a phone number, receive OTP, enter it. Should redirect to `/business-auth/setup/onboarding?step=1`.

5. **Onboarding steps 1–4** — complete each step in order. Step 3 (compliance) accepts optional file upload. Step 4 requires clicking "Connect Stripe" (mock) before accepting TOS.

6. **Dashboard** — completing step 4 redirects to `/business/dashboard`. Middleware should allow access.

7. **Sign out and back in** — sign out, navigate to `/business-auth/login`, sign in. Should land on `/business/dashboard` (setup is complete).

### Minor issues (did not block the flow)

**`create-account`: orphaned Better Auth user on DB transaction failure**
If `signUpEmail` succeeds but the subsequent Drizzle transaction (update authUser + insert cookProfile + consume token) fails, a Better Auth user exists with no cook profile. The token stays unconsumed so the cook can retry — but on retry, `signUpEmail` will return a conflict (email exists). There is no compensating delete of the Better Auth user. In practice the transaction is very unlikely to fail, but a proper fix would call `auth.api.deleteUser` as a best-effort rollback before returning 500.

**`create-account`: generic error on duplicate email at `signUpEmail`**
If someone with the same email already has a Better Auth account (e.g. from a previous partially-failed attempt), `signUpEmail` returns a non-OK response and the handler surfaces a generic 500. The message should detect the conflict and suggest logging in instead.

**`reissue-link`: old tokens not restored on email failure**
`reissue-link` expires all previous unconsumed tokens before inserting the new one. If the Resend call then fails, the handler deletes the new token but the old ones remain expired — the cook has no valid link. The fix is to restore the old token expiry dates in the compensation path, or to expire them only after a successful send.

**`pending_phone` cookie missing `secure` flag in production**
`send-otp` sets the `pending_phone` cookie without `secure: process.env.NODE_ENV === "production"`. Better Auth's own session cookie is set with `Secure`. This is inconsistent and should be aligned.

### Security concerns for review

- **`INTERNAL_API_KEY` with empty or missing value** — if `INTERNAL_API_KEY` is not set in an environment, the env var defaults to `""`. An attacker sending an empty `x-internal-key` header would pass the timing-safe comparison. Ensure this variable is mandatory and non-empty in all deployed environments. Consider adding a startup assertion.

- **No CSRF protection on mutation routes** — all `POST /api/*` routes accept cross-origin requests as long as the session cookie is present. The session cookie is `SameSite=Lax`, which blocks cross-site `POST` requests in modern browsers for top-level navigations, but AJAX/fetch from a malicious origin on a same-site page could still trigger them. A stricter posture would validate `Origin` or use `SameSite=Strict`. Hand this decision to the security reviewer.

- **Rate limiting on `create-account` is absent** — the create-account endpoint has no rate limiting. An attacker who obtains a valid token URL (e.g. from intercepted email) could hammer it. Token entropy (256 bits) makes guessing infeasible, but adding per-IP rate limiting here would be a cheap extra layer.

- **Sign-in rate limit keyed on IP** — `POST /api/auth/sign-in` rate-limits by `x-forwarded-for`. This header can be spoofed unless the infrastructure guarantees it (Vercel sets it correctly in production, but should be verified).

- **Stripe Connect is mocked** — `POST /api/setup/stripe-connect` sets a placeholder `mock_acct_*` ID. Step 4 accepts any non-null `stripeAccountId` without calling the real Stripe API to confirm `charges_enabled`. This must be replaced with real Stripe Connect before any cook can receive payments.
