# 7eats — Cook Onboarding Flow

This document describes the full cook onboarding experience from initial application to first day live on the platform. It covers every page involved, what it contains, what it does, and any technical constraints or edge cases to be aware of. This document is the source of truth for frontend behavior and flow logic.

---

## Tech Stack

- Framework: Next.js 16 App Router with TypeScript
- Database: Neon (PostgreSQL) via Drizzle ORM
- Auth: Neon Auth (session-based after password creation)
- Payments: Stripe Connect
- SMS and 2FA: Twilio Verify
- Email: Resend
- File Storage: Cloudflare R2 or Supabase Storage

---

## Route Group Overview

```
/public/*         — public marketing site, no auth required
/business/*       — cook-facing pages, mix of public and authenticated
/business-auth/*  — cook authentication and onboarding wizard
/app/*            — consumer-facing product
/app-auth/*       — consumer authentication
```

Admin pages are not in scope for this phase. Application review and link issuance are handled by the team directly.

---

## Phase 1 — Initial Application

### `/business/home`

**What it is:** The permanent cook-facing marketing page. Explains what 7eats offers cooks as operators.

**What it contains:**
- Headline and subheadline speaking to a cook already selling informally
- Four core benefits: order and pickup coordination, upfront payment processing, customizable listings, dynamic pricing and promotions
- A single CTA linking to `/business/application`

**Auth:** None required. Fully public.

---

### `/business/application`

**What it is:** A two-step lead capture form. Not account creation. Gives the team enough information to have a meaningful review call.

**Step 1 — Business info:**
- Kitchen or operating name
- Kitchen type — dropdown: Licensed home kitchen, Commercial kitchen (rented), Ghost kitchen, Restaurant / café, Community kitchen, Other
- Years operating — dropdown: Less than 1 year, 1-2 years, 3-5 years, 6-10 years, 10+ years
- Street address
- City
- Province — dropdown of all Canadian provinces and territories
- Postal code
- Website — optional
- Business phone
- Business email

**Step 2 — Contact info:**
- Full name
- Role — dropdown: Owner, Co-owner, Head Chef / Cook, Manager, Operations Lead, Other
- Phone number
- Email address

**What it does:** On submission writes the application record to the database with a status of pending review. Redirects to `/business/application-confirmation`. Notifies the ops team.

**Auth:** None required. Fully public.

**Edge cases:**
- If the same email submits twice, show an error rather than creating a duplicate record
- Phone number should accept Canadian formats and strip formatting before storing
- Form must be fully usable on mobile

---

### `/business/application-confirmation`

**What it is:** A static confirmation screen shown immediately after the application is submitted.

**What it contains:**
- Confirmation that the application was received
- Clear expectation: the team will reach out within 48 hours by phone
- A brief outline of what happens next: review, call, setup link, go live

**Auth:** None required.

**Edge cases:**
- Should not be directly accessible without a prior form submission — redirect to `/business/application` if accessed directly

---

## Phase 2 — Review and Link Issuance

The 7eats team reviews the application and calls the cook. No admin interface is in scope for this phase — this is handled manually by the team. Once approved, the team triggers a magic link email to the cook's application email via an internal tool or direct DB action.

The magic link points to `/business-auth/setup/create-password?token=` with a signed, one-time-use token that expires after 3 days.

---

## Phase 3 — Magic Link Entry and Password Creation

### `/business-auth/setup/create-password?token=`

**What it is:** The first page a cook sees after clicking the magic link. Handles token validation and password creation.

**What it contains:**
- Server-side token validation on page load
- If valid: a password field and confirm password field with a continue button
- No subtitle or explanation text — the context is set by the email

**What it does:**
- Validates the token against the database — checks existence, expiry, and whether it has already been used
- If invalid or expired: redirects to `/business-auth/setup/expired`
- If valid: renders the password form
- On password submission: hashes and saves the password, creates a Neon Auth session (logs the cook in), marks the token as consumed (one-time use — the magic link is permanently invalidated at this point), and redirects to `/business-auth/setup/verify-phone`
- If the cook is already logged in when they hit this URL (returning via bookmarked link): redirect to their `currentSetupStep`

**Auth:** No session required. The token is the authentication mechanism for this page only.

**Edge cases:**
- Token must be validated server-side, never client-side
- Password confirmation mismatch shows an inline error, no page reload
- Missing token parameter redirects to `/business-auth/setup/expired`
- Token is one-time use — consumed on password set, not at any later step

---

### `/business-auth/setup/expired`

**What it is:** Dead-end screen for invalid, expired, or already-used magic links.

**What it contains:**
- Clear explanation of what happened
- Support contact so the cook can request a new link from the team
- No self-serve reissue — always admin-triggered

**Auth:** None required.

---

## Phase 4 — Phone Verification

### `/business-auth/setup/verify-phone`

**What it is:** Phone verification step. Comes immediately after password creation, before the onboarding wizard.

**What it contains:**
- Stage 1: a phone number input (pre-populated from application, editable), submit button
- Stage 2: a six-digit OTP input, resend code option, change number option

**What it does:**
- Stage 1: on submit, sends an OTP to the entered number via Twilio Verify
- Stage 2: validates the OTP. On success: marks `phone_verified = true` on the user record and redirects to `/business-auth/setup/onboarding?step=1`
- On invalid OTP: inline error, allows retry
- After three failed attempts: locks verification for 10 minutes

**Auth:** Cook session required (set during create-password). No session redirects to `/business-auth/setup/create-password`.

**Edge cases:**
- Phone number is editable at this stage — cook can correct it if the application had a typo
- Resend is rate-limited
- No `autoFocus` on inputs (accessibility constraint)

---

## Phase 5 — Setup Wizard

### `/business-auth/setup/onboarding?step=1` through `?step=4`

**What it is:** A four-step wizard managing state via a URL query parameter. Protected by session auth. Progress is tracked in the database via a `currentSetupStep` field — if a cook leaves and returns, they are routed to their last incomplete step automatically.

**General behavior:**
- Fields pre-populated from the approved application where applicable (display name, pickup address)
- Steps 1 and 2 have: Save and Continue (primary), Back (secondary)
- Steps 3 and 4 have: Save and Continue (primary), Back (secondary), and a "Complete later" button in the step header that routes to `/business/dashboard`
- Step 1 has no Back button — verify-phone is already done
- Cooks who reach the dashboard via "Complete later" can create listing drafts but cannot publish until all setup steps are complete
- Step advancement uses `router.push()` so each step creates a history entry

---

**Step 1 — Cook Profile** `?step=1`

What the cook fills in:
- Display name — pre-populated from application kitchen name, editable
- Profile photo — wired file input, JPEG or PNG, minimum 400×400, required (TODO: content moderation + R2/Supabase upload)
- Bio — minimum 100 characters, maximum 500, character count shown in real time
- Cuisine types — required, multi-select pill group
- Niche — optional, multi-select pill group (General meal prep, High-protein / Gym, Weight loss, Bulking, Family meals, Breakfast / Brunch, Office lunches, Student-friendly, Post-workout recovery, Senior nutrition)
- Dietary tags — optional, multi-select pill group (Halal, Vegan, Vegetarian, Gluten-free, Kosher, Nut-free, Dairy-free, Low-carb / Keto, High-protein)
- Instagram or social link — optional, URL input

Validation:
- Display name required
- Profile photo required (client-side only; a returning cook's existing photo
  counts, so this does not retroactively block cooks already past this step)
- Bio minimum 100 characters
- At least one cuisine type required

---

**Step 2 — Operations** `?step=2`

What the cook fills in:
- Pickup address — pre-populated from application, editable. Only revealed to customers after order confirmation, never public
- Pickup days — multi-select pill group (Mon through Sun)
- Pickup window — From / To time inputs, applied to all pickup days (same hours every week)
- Order lead time — radio: Same day, 1 day before, 2 days before, 3 days before, 4 days before, 5 days before. This cutoff governs both when orders close and the cancellation deadline — customers ordering after it are booked for the next available day, cancellations before it receive a full refund, no refund after
- Max weekly order capacity — number input, min 5, max 500
- Delivery — radio: No delivery / I deliver myself
- Special requests — checkbox: accepts ingredient swaps and notes from customers

Refund policy is a 7eats platform standard tied to the order lead time. It is not configurable per cook.

Validation:
- Pickup address required
- Lead time required

---

**Step 3 — Compliance** `?step=3`

What the cook fills in:
- Food handler certificate ID number — text input, found on the physical certificate
- Full name as it appears on the certificate — text input
- Certificate expiry date — date input, must be a future date. Used to trigger renewal reminders
- Photo of certificate — optional file upload, JPEG / PNG / PDF, max 10MB (TODO: R2/Supabase upload)

Header includes a "Complete later" button that routes to `/business/dashboard`. Cook can return to complete this before publishing any listing.

Validation:
- Certificate ID number required
- Full name required
- Expiry date required and must be future

---

**Step 4 — Get Paid** `?step=4`

What the cook does:
- Connects their Stripe account via Stripe Connect Express. Clicking the button calls a server action that creates the Connect account and returns a Stripe-hosted URL. The cook completes banking details on Stripe's own pages — the platform never sees banking information. On return, `stripe_account_id` is saved to their profile
- Reviews platform terms displayed as a summary table: 7.5% platform fee, full refund before order cutoff, direct deposit via Stripe (payout cadence TBD)
- Accepts the Terms of Service and Privacy Policy — checkbox with timestamp stored

Header includes a "Complete later" button that routes to `/business/dashboard`.

On completion of step 4: `setup_complete` is flagged true on the user record.

Validation:
- Stripe account must be connected
- ToS checkbox must be checked

Edge cases:
- If the cook closes the Stripe tab without completing Connect, they return to step 4 and can retry
- Do not flag `setup_complete` until Stripe confirms the Connect account is active

---

## Phase 6 — Cook Dashboard

### `/business/dashboard`

**What it is:** The cook's home in the operator portal.

**What it contains:**
- If setup incomplete: a persistent prompt showing which steps are still outstanding, with a CTA to resume. Cook can still browse the dashboard and create listing drafts
- If setup complete: a welcome state, prompt to create their first menu, empty states for orders, earnings, and reviews
- Listings created before setup is complete are saved as drafts and cannot be published until all setup steps are done

**Auth:** Cook session required. No session redirects to `/business-auth/login`.

---

## Middleware Behavior Summary

Auth middleware runs before every page load and enforces:

- `/business-auth/setup/verify-phone` and `/business-auth/setup/onboarding` require a valid cook session — no session redirects to `/business-auth/setup/create-password`
- Onboarding steps enforce `currentSetupStep` — a cook cannot access a step ahead of where they are
- `/business/*` routes require a valid cook session — no session redirects to `/business-auth/login`
- Public routes — `/business/home`, `/business/application`, `/business/application-confirmation` — are always accessible without a session

---

## Full Flow at a Glance

```
/business/home
  Cook reads the sell page, clicks apply

/business/application
  Step 1: kitchen name, type, years operating, address, website, business phone/email
  Step 2: contact name, role, phone, email

/business/application-confirmation
  Told to expect a call within 48 hours

--- team reviews application, calls cook, sends magic link ---

/business-auth/setup/create-password?token=
  Token validated server-side
  If invalid or expired: redirect to /business-auth/setup/expired
  If valid: cook sets password, session created, token consumed
  Redirect to verify-phone

/business-auth/setup/verify-phone
  Cook enters phone number (pre-populated, editable)
  OTP sent via Twilio
  Cook enters OTP
  phone_verified flagged true
  Redirect to onboarding step 1

/business-auth/setup/onboarding?step=1
  Cook profile — display name (pre-filled), photo, bio, cuisine types, niches, dietary tags, social link
  Back: n/a | Save and continue

/business-auth/setup/onboarding?step=2
  Operations — pickup address (pre-filled), pickup days, window, lead time, capacity, delivery, special requests
  Back: step 1 | Save and continue

/business-auth/setup/onboarding?step=3
  Compliance — certificate ID, full name on cert, expiry date, optional photo
  Complete later (header) → dashboard | Back: step 2 | Save and continue

/business-auth/setup/onboarding?step=4
  Get paid — Stripe Connect, platform terms, ToS
  Complete later (header) → dashboard | Back: step 3 | Complete setup
  On submit: setup_complete flagged true

/business/dashboard
  Accessible at any point after login
  Incomplete setup: prompt showing outstanding steps, draft listings allowed
  Complete setup: live on platform, prompted to create first menu
```
