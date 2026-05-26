# Cook Onboarding — Implementation Plan

End-to-end backend wiring for the cook onboarding flow, from application submission to first dashboard login. Organized as sequential milestones. Each one is independently shippable and testable before moving to the next.

---

## Packages to install before starting

```bash
pnpm add bcryptjs jose resend twilio stripe
pnpm add -D @types/bcryptjs
```

| Package | Purpose |
|---|---|
| `bcryptjs` | Password hashing (cost factor 12) |
| `jose` | JWT creation and verification for session cookies |
| `resend` | Magic link emails |
| `twilio` | Phone OTP via Twilio Verify |
| `stripe` | Stripe Connect Express |

All other needs (Drizzle, Zod v4, S3/R2, rate limiting) are already in place.

---

## Milestone 1 — Application Form Server Action

**Route:** `POST` via server action on `/business/application`

**What it does:** Validates and writes the cook's application to `cook_applications`. Notifies the team. Redirects to confirmation.

**Libraries:** Drizzle, Zod, Resend (team notification)

**Implementation:**
1. Write a Zod schema matching all `FormState` fields. Canadian postal code regex (`/^[A-Z]\d[A-Z]\d[A-Z]\d$/i`), phone stripped to digits before storing, email lowercased.
2. Server action receives the form data, validates with Zod, inserts into `cook_applications` with `status: 'pending_review'`.
3. On success, set a short-lived `application_submitted` HTTP-only cookie (signed with `jose`, 10 min TTL) and redirect to `/business/application-confirmation`.
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
3. Generate token: `crypto.randomBytes(32).toString('hex')` (64-char hex string). Hash it with SHA-256 before storing (same pattern as `lib/hash.ts`). Store raw token is never written to DB.
4. Insert into `setup_tokens`: `{ applicationId, tokenHash, expiresAt: now + 7 days }`.
5. Update `cook_applications` status to `approved`.
6. Send email via Resend to `contact_email` with the magic link: `https://7eats.com/business-auth/setup/create-password?token=<raw_token>`.

**Edge cases:**
- **Application already approved:** Return 409 with `"Application is already approved."` Do not issue a second token.
- **applicationId not found:** Return 404.
- **Re-issuing a link (e.g. cook lost the email):** Add a separate `POST /api/internal/reissue-link` endpoint. It marks all existing unconsumed tokens for that application as expired (`expiresAt = now`) and issues a fresh one.
- **Resend failure:** Roll back the token insert and the status update. Return 502 — the team can retry. Do not leave an approved application without a deliverable link.

---

## Milestone 3 — Create Password + Account Creation

**Route:** `/business-auth/setup/create-password` (page + server action)

**What it does:** Validates the token, shows the password form, and on submission creates the `users` row, the `cook_profiles` row, hashes the password, starts a session, and consumes the token — all in a single DB transaction.

**Libraries:** Drizzle (transaction), `bcryptjs`, `jose`, Node `crypto`

**Implementation:**
1. **Page load (server component):** Read `?token=` from URL. If missing, redirect to `/business-auth/setup/expired`. Hash the token with SHA-256, query `setup_tokens` where `token_hash = hash AND consumed_at IS NULL AND expires_at > now()`. If no row found, redirect to `/business-auth/setup/expired`.
2. **Already logged in:** If a valid session cookie exists on page load, read `currentSetupStep` from `cook_profiles` and redirect to the correct onboarding URL.
3. **Password form (client component):** Two fields — password and confirm password. Inline validation: minimum 8 characters, must match. No page reload on mismatch.
4. **Server action on submit:**
   - Re-validate the token (same DB check as step 1 — tokens can expire between page load and submit).
   - Hash password with `bcryptjs` at cost factor 12.
   - Open a Drizzle transaction:
     - `INSERT INTO users` — `role: 'cook'`, `status: 'active'`, `firstName` and `lastName` from `contact_first_name` / `contact_last_name` on the application, `email` from `contact_email`, `passwordHash`.
     - `INSERT INTO cook_profiles` — `userId`, `applicationId`, `displayName` pre-populated from `kitchen_name`.
     - `UPDATE setup_tokens SET consumed_at = now()` where `id = token.id`.
   - If the transaction fails, return a generic error. The token remains unconsumed and the cook can retry.
5. **Session:** Create a JWT with `jose` containing `{ sub: userId, role: 'cook' }`, signed with `process.env.SESSION_SECRET`. Set as an HTTP-only, Secure, SameSite=Strict cookie named `session`, 30-day expiry. Redirect to `/business-auth/setup/verify-phone`.

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

**Libraries:** `jose`, Next.js `NextResponse`

**Route rules:**

| Route pattern | Rule |
|---|---|
| `/business/application` | Always public |
| `/business/application-confirmation` | Requires `application_submitted` cookie |
| `/business-auth/setup/create-password` | Public — token is the auth |
| `/business-auth/setup/expired` | Always public |
| `/business-auth/setup/verify-phone` | Requires valid session. If `phone_verified = true`, redirect to `/business-auth/setup/onboarding?step=1` |
| `/business-auth/setup/onboarding` | Requires valid session + `phone_verified = true`. `?step` param must equal `currentSetupStep` — if ahead, redirect back to correct step. If `setup_complete = true`, redirect to `/business/dashboard` |
| `/business/*` | Requires valid session. No session → redirect to `/business-auth/login` |

**Implementation:**
1. Parse and verify the `session` JWT cookie with `jose`. If invalid or missing, treat as unauthenticated.
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
   - Store the normalized number in session or a short-lived cookie so stage 2 knows which number to verify.
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
3. Resolve tag IDs: look up `tags` rows where `label IN (selectedCuisines)` and `category = 'cuisine'`. Same for niches and dietary. If any label doesn't resolve (data mismatch), log and skip — do not fail the save.
4. In a transaction: `UPDATE cook_profiles SET display_name, bio, photo_url, social_link, current_setup_step = 2`. Delete existing `cook_profile_tags` for this profile, re-insert selected ones.

**Step 2 server action (Operations):**
1. Validate: `pickupAddress` required, `leadTime` required and must be a valid `leadTimeEnum` value.
2. Parse `maxCapacity` as integer, clamp to 5–500 range server-side regardless of client input.
3. `UPDATE cook_profiles SET pickup_address, pickup_days, pickup_from, pickup_to, lead_time, max_capacity, delivery, accepts_special_requests, current_setup_step = 3`.

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
3. `INSERT INTO cook_certifications` — `cookId`, `name: 'Food Handler Certificate'`, `holderName`, `certificateNumber`, `expiresAt`, `fileUrl`, `status: 'pending_review'`.
4. `UPDATE cook_profiles SET current_setup_step = 4`.
5. **"Complete later":** If cook clicks Complete later, redirect to `/business/dashboard` without saving. `currentSetupStep` stays at 3. Dashboard shows an outstanding steps prompt.

**Step 4 server action (Get Paid):**
1. **Stripe Connect initiation:** When cook clicks "Connect with Stripe →", call a separate server action (not the step save). It calls `stripe.accounts.create({ type: 'express' })`, stores nothing yet, returns the onboarding URL from `stripe.accountLinks.create(...)`. Client redirects to Stripe.
2. **Stripe return:** Stripe redirects back to `/business-auth/setup/onboarding?step=4&stripe=return`. On page load, call `stripe.accounts.retrieve(accountId)` to confirm `charges_enabled = true`. If confirmed, save `stripe_account_id` to `cook_profiles` and mark the Stripe box as connected.
3. **Step 4 save (final submit):** Validate `stripeConnected` (check `stripe_account_id IS NOT NULL` in DB — never trust client state) and `tosAccepted`. In a transaction: `UPDATE cook_profiles SET tos_accepted_at = now(), setup_complete = true, current_setup_step = 4`. Redirect to `/business/dashboard`.

**Edge cases:**
- **Cert expiry date in the past:** Server action rejects with `"Expiry date must be in the future."` The `min` attribute on the date input is a UX hint only.
- **File too large or wrong type:** Validate before upload, return error immediately.
- **Cook closes Stripe tab without finishing:** They return to step 4 with no `stripe_account_id`. The Stripe box shows "Connect with Stripe →" again. They can retry. Nothing is broken.
- **`setup_complete` check on final submit:** Server action re-reads `stripe_account_id` from DB and calls Stripe API to confirm `charges_enabled`. Does not rely on `form.stripeConnected` from the client.
- **"Complete later" on step 4:** Same as step 3 — redirect to dashboard, `setup_complete` stays false, prompt shown on dashboard.
- **Cook publishes a listing before setup is complete:** Listing creation checks `setup_complete` server-side before allowing `status` to be set to anything other than `draft`. This is enforced in the listings server action, not just the UI.

---

## Security summary

| Threat | Mitigation |
|---|---|
| Token guessing | 32 random bytes = 256 bits of entropy. Stored as SHA-256 hash. |
| Token replay | One-time use. `consumed_at` set in the same transaction as account creation. |
| Token enumeration | Expired and consumed tokens return the same `/setup/expired` response — no distinction. |
| Session hijacking | HTTP-only, Secure, SameSite=Strict cookie. 30-day expiry. |
| OTP brute force | 3 attempts then 10-min lockout via existing `rate-limit.ts` |
| Step skipping | Middleware reads `currentSetupStep` from DB on every request — client URL tampering has no effect. |
| Stripe account bypass | Final submit re-validates `charges_enabled` via Stripe API, not client state. |
| Cert expiry spoofing | Server re-validates expiry is a future date regardless of client input. |
| Duplicate applications | Unique index on `contact_email` in `cook_applications`. Caught at DB level. |
| Internal API exposure | `x-internal-key` header required. Never referenced in client code. |
