# 7eats — Cook Onboarding Flow

This document describes the full cook onboarding experience from initial application to first day live on the platform. It covers every page involved, what it contains, what it does, and any technical constraints or edge cases to be aware of. Backend implementation details are left to the development team. This document is the source of truth for frontend behavior and flow logic.

---

## Tech Stack

- Framework: Next.js 14 App Router with TypeScript
- Database: Neon (PostgreSQL) via Drizzle ORM
- Auth: Neon Auth
- Payments: Stripe Connect
- SMS and 2FA: Twilio Verify
- Email: Resend
- File Storage: Cloudflare R2 or Supabase Storage

---

## Route Group Overview

Route groups appear in real browser URLs. No route group prefix holds a page directly — pages always live one level inside their prefix. Hitting a prefix directly returns a 404.

```
/public/*         — public marketing site, no auth required
/business/*       — cook-facing pages, mix of public and authenticated
/business-auth/*  — cook authentication and onboarding wizard
/app/*            — consumer-facing product
/app-auth/*       — consumer authentication
/admin/*          — internal ops, admin session required
```

---

## Phase 1 — Initial Application

### `/business/home`

**What it is:** The long-term cook-facing sell page. This is not the waitlist and does not mention the founding cook offer. It is a permanent marketing page that exists after launch and explains what 7eats gives cooks as operators.

**What it contains:**
- A headline and subheadline speaking directly to a cook who is already selling informally and wants more
- Four core benefits clearly described: order and pickup coordination, upfront payment processing so cooks never chase e-transfers, customizable listings with nutritional information and dietary tags, dynamic pricing and flash deal tools
- A how it works section — apply, get called, complete setup, go live
- Social proof when available — cook testimonials, order volumes, earnings examples
- A single CTA linking to `/business/application`

**What it does not contain:** Any mention of the founding cook offer, waitlist mechanics, or time-limited deals. Those live on the public waitlist site.

**Auth:** None required. Fully public.

---

### `/business/application`

**What it is:** The initial application form. This is not account creation. It is a lead capture that gives the team enough information to have a meaningful call.

**What it contains:**
- Full name
- Email address
- Phone number
- Kitchen name or operating name
- Neighborhood in Toronto — dropdown from a curated list
- Primary cuisine types — multi-select from a structured list, never free text
- How they currently take orders — dropdown with options like Instagram DMs, WhatsApp, Facebook, word of mouth, other
- Approximate weekly volume — a range selector, not a precise number field

**What it does:** On submission writes the application record to the database with a status of pending call. Redirects to `/business/application-confirmation`. Sends a notification to the ops team via email or Slack.

**Auth:** None required. Fully public.

**Edge cases:**
- If the same email submits twice, show an error telling them their application is already under review rather than creating a duplicate record
- Phone number field should accept Canadian formats and strip formatting before storing
- The form should be submittable on mobile — cooks will often do this from their phone

---

### `/business/application-confirmation`

**What it is:** A static holding screen shown immediately after the application is submitted.

**What it contains:**
- A confirmation that the application was received
- A clear expectation that the team will call within 48 hours on the phone number they provided
- No further action required from the cook at this point
- Optionally a short list of things to have ready for the call — nothing too detailed, just a heads up

**What it does:** Nothing interactive. Pure confirmation state.

**Edge cases:**
- This page should not be directly accessible without having just submitted a form — if someone navigates to it directly without a submission context it should redirect to `/business/application`

---

## Phase 2 — The Call and Admin Actions

### `/admin/dashboard`

**What it is:** The internal ops home screen for the 7eats team.

**What it contains:**
- Platform health overview — total applications, pending calls, cooks in setup, active cooks
- Quick links to the main admin sections
- Any flagged items requiring attention — expired tokens, stalled onboardings, reissue requests

**Auth:** Admin session required. Any non-admin session redirects to `/admin/login`.

---

### `/admin/applications`

**What it is:** A list of every cook application submitted through `/business/application`.

**What it contains:**
- A table or card list of all applications
- Each row shows: name, kitchen name, neighborhood, cuisine types, submission date, current status
- Status filter tabs — pending call, called, approved, rejected
- Each row links to `/admin/applications/[id]`

**Auth:** Admin session required.

---

### `/admin/applications/[id]`

**What it is:** The detail view for a single cook application. This is where the admin works during and after the call.

**What it contains:**
- All information the cook submitted in the application form, displayed clearly
- A notes field — free text, editable at any time, saved automatically or on blur — where the admin records observations from the call
- A status dropdown to update the application status
- A Send Setup Link button that triggers the magic link flow
- A Reissue Link button that appears only after a link has already been sent and has either expired or the cook requests a new one
- The date and time the last link was sent, and whether it has been used

**What it does:**
- Send Setup Link creates a user account for the cook using their application email and phone, generates a signed token with a seven day expiry, and fires a minimal email via Resend containing the magic link and a one-liner referencing the call
- Reissue Link generates a fresh token and sends a new email without touching the cook's existing account or any progress they have already saved
- Status changes are saved immediately and reflected in the applications list

**Auth:** Admin session required.

**Edge cases:**
- The Send Setup Link button should be disabled if a valid unexpired link already exists — show the expiry date instead and offer the Reissue button only after expiry
- If the cook's email bounces, surface that failure visibly on this page so the admin can follow up via phone
- Notes should save without a dedicated save button to avoid lost observations during a live call

---

## Phase 3 — Magic Link Entry and Password Creation

### `/business-auth/setup/create-password?token=`

**What it is:** The first page a cook sees after clicking the magic link in their email. This page handles token validation and password creation in a single step — there is no intermediate redirect page.

**What it contains:**
- On page load: server-side token validation runs immediately
- If valid: a simple password creation form with a password field and a confirm password field, a brief explanation of why they are setting a password, and a continue button
- If the cook has already set a password and is returning to the wizard via the same link: no form is shown, the page detects existing credentials and redirects directly to their last incomplete wizard step

**What it does:**
- Validates the token against the database on every page load — checks existence, expiry, and used status
- If invalid or expired: redirects immediately to `/business-auth/setup/expired`
- If valid: creates a Neon Auth session for the cook's account
- On password submission: saves the hashed password to the user record and advances to `/business-auth/setup/onboarding?step=1`
- Does not mark the token as used at this point — the token stays valid so the cook can return to the wizard via the same link throughout the seven day window

**Auth:** No existing session required. The token is the authentication mechanism for this page.

**Edge cases:**
- The token must be validated server-side on every load, never client-side
- Password confirmation mismatch should show an inline error, not a page reload
- The page should handle the case where the URL token parameter is missing entirely — redirect to `/business-auth/setup/expired` with a generic message
- If the session already exists and setup is complete, redirect to `/business/dashboard` immediately

---

### `/business-auth/setup/expired`

**What it is:** A dead-end screen shown when a magic link is invalid, expired, or already used.

**What it contains:**
- A clear explanation of what happened — the link expired, was already used, or is not valid
- A support contact so the cook can request a new link from the team
- No self-serve reissue option — reissuance is always admin-triggered to maintain quality control

**Auth:** None required.

---

## Phase 4 — Setup Wizard

### `/business-auth/setup/onboarding?step=1` through `?step=4`

**What it is:** A single page multi-step wizard managing state via a URL query parameter. The step parameter drives which form is rendered. Each step saves independently so closing the browser loses nothing. A cook who returns via the magic link after already setting a password is routed directly to their last incomplete step.

**General behavior across all steps:**
- All fields from the original application — kitchen name, neighborhood, cuisine types — are pre-populated and editable
- Each step has two action buttons: Save and Continue which saves and advances, and Save for Later which saves and redirects to `/business-auth/setup/saved`
- A progress indicator shows which steps are complete, in progress, and remaining
- The cook cannot skip steps — each step must be completed before the next is accessible
- Navigating backwards to a completed step is allowed and changes can be saved
- Step advancement uses `router.push()` not `router.replace()` so each step creates a browser history entry — the browser back button navigates through wizard steps naturally without exiting the wizard entirely

---

**Step 1 — Cook Profile** `?step=1`

What the cook fills in:
- Display name — what customers see, can be their name or a kitchen name
- Profile photo — required, minimum resolution enforced, runs through content moderation before saving, stored in R2 or Supabase Storage
- Bio — minimum 100 characters, maximum 500, a structured prompt helps them write it
- Cuisine types — pre-populated from application, editable, multi-select from structured list
- Dietary tags — halal, vegan, gluten-free, kosher, nut-free, and others — structured multi-select, never free text

Edge cases:
- Profile photo is mandatory and the step cannot be completed without one
- Bio character count should be visible and update in real time
- Cuisine type and dietary tag fields must never accept free text input — dropdowns or checkbox groups only, this is a food safety concern not just a UX preference

---

**Step 2 — Operations** `?step=2`

What the cook fills in:
- Pickup address — the specific address where customers collect orders, stored but only revealed to a customer after their order is confirmed, never publicly displayed
- Pickup window — a time range for when customers can collect, shown to consumers when browsing
- Prep days — multi-select for which days of the week they cook
- Maximum weekly order capacity — a number field with a minimum of 5 and a maximum of 200 at this stage
- Kitchen type — home kitchen, licensed home kitchen, or commercial kitchen

Edge cases:
- Pickup address should be validated as a real address — a Google Maps API lookup or postal code validation prevents garbage input
- The pickup address must never appear on public cook profile pages — it is order-confirmation-only information
- Kitchen type selection affects what compliance documents are required in step 3 — pass this selection forward

---

**Step 3 — Compliance** `?step=3`

What the cook fills in:
- Food handler certificate — file upload, PDF or JPEG, maximum 10MB, stored in R2 or Supabase Storage, URL and expiry date saved to the database
- Certificate expiry date — used to trigger renewal reminders and flag lapsed certificates in the admin panel
- Food safety declaration — a checkbox confirming they prepare food in a clean kitchen, follow safe handling practices, and will disclose all allergens accurately. Timestamp stored on check.

Edge cases:
- If the cook selected commercial kitchen in step 2, the food handler certificate requirement may be replaced by a commercial kitchen license — the form should adapt based on step 2 selection
- Certificate expiry date must be in the future — reject past dates at validation
- File upload must validate file type and size client-side before upload and server-side after — do not rely on client validation alone
- Images uploaded as certificates should go through basic content moderation before being saved

---

**Step 4 — Legal and Payments** `?step=4`

What the cook fills in and does:
- Stripe Connect onboarding — a button that initiates the flow. Clicking it calls a server action that creates a Stripe Connect Express account and returns a Stripe-hosted URL. The cook is redirected to Stripe's own onboarding pages where they enter their banking details directly — the platform never sees banking information. On return from Stripe the stripe_account_id is saved to their profile.
- Commission rate acknowledgment — the exact rate of 7.5% is displayed with a worked dollar example. An explicit checkbox is required. The timestamp of acknowledgment is stored.
- Terms of service agreement — full ToS acceptance required. Checkbox with timestamp stored.
- Food safety declaration if not already completed in step 3

On final submission of step 4, setup_complete is flagged true on the user record and the cook is advanced to phone verification.

Edge cases:
- Stripe Connect onboarding is a redirect away from the platform and back. The return URL must be handled gracefully — on return, check Stripe's API for the account status rather than trusting URL parameters alone
- If the cook closes the Stripe tab without completing Connect onboarding, they land back on step 4 with a status message and can retry
- The commission acknowledgment and ToS checkboxes cannot be pre-checked — the cook must check them manually
- Do not advance past step 4 until Stripe confirms the Connect account is active and capable of receiving payouts

---

### `/business-auth/setup/saved`

**What it is:** A confirmation screen shown when the cook clicks Save for Later on any wizard step.

**What it contains:**
- Confirmation that their progress has been saved
- A reminder that the magic link is valid for seven days from when it was sent
- The email address the link was sent to, so they know where to look
- A prompt to return when they are ready and have all their information available

**Auth:** Cook session required. Redirect to `/business-auth/setup/create-password` if no session exists.

---

## Phase 5 — Phone Verification and 2FA

### `/business-auth/setup/verify-phone`

**What it is:** The final gate before the cook can access their dashboard. Reached automatically after step 4 submits successfully.

**What it contains:**
- A statement that an OTP has been sent to the phone number they provided during the application — the number is partially masked for display
- A six-digit OTP input field
- A resend code link available after 60 seconds
- A note explaining that 2FA will be active on their account going forward

**What it does:**
- Twilio Verify sends an OTP to the phone number on the cook's account on page load
- On valid OTP entry: marks phone_verified and two_fa_enabled true on the user record, marks the setup token as used so the magic link is permanently invalidated, and redirects to `/business/dashboard`
- On invalid OTP: shows an inline error and allows retry
- After three failed attempts: locks the verification for 10 minutes and shows a message to try again later

**Auth:** Cook session required with setup_complete true. If either condition is missing, redirect back to the appropriate step.

**Edge cases:**
- This is a hard gate — no route in `/business/*` is accessible until phone_verified is true, enforced by Neon Auth middleware
- The token is marked as used here and only here — not earlier in the flow — so the cook can freely return to the wizard via the magic link throughout the setup process
- If the phone number on file is wrong the cook has no self-serve way to change it at this stage — they contact support, the admin updates it, and a new OTP is sent

---

## Phase 6 — Cook Dashboard

### `/business/dashboard`

**What it is:** The cook's home in the operator portal. First destination after completing full onboarding.

**What it contains on first visit:**
- A welcome state acknowledging they are live on the platform
- A prompt to create their first weekly menu with a direct link to `/business/menu`
- A summary of their profile status
- Empty states for orders, earnings, and reviews with contextual prompts

**Auth:** Cook session required with setup_complete true and phone_verified true. Neon Auth middleware enforces this on every `/business/*` route. Any cook missing either condition is redirected to the appropriate incomplete step.

---

## Middleware Behavior Summary

Neon Auth middleware runs at the edge before any page loads and enforces the following:

- Any request to `/business/*` without a cook session redirects to `/business-auth/login`
- Any request to `/business/*` with a cook session but setup_complete false redirects to the last incomplete wizard step
- Any request to `/business/*` with setup_complete true but phone_verified false redirects to `/business-auth/setup/verify-phone`
- Any request to `/admin/*` without an admin session redirects to `/admin/login`
- Any request to `/app/*` account routes without a consumer session redirects to `/app-auth/login`
- Public routes under `/public/*` and `/business/home`, `/business/application`, `/business/application-confirmation` are always accessible without a session

---

## Full Flow at a Glance

```
/business/home
  Cook reads the sell page, clicks apply

/business/application
  Fills in six fields, submits

/business/application-confirmation
  Told to expect a call within 48 hours

--- admin opens panel ---

/admin/dashboard
  Overview of platform and pending items

/admin/applications
  Finds the cook's submission in the list

/admin/applications/[id]
  Reviews info, calls the cook
  Fills in call notes during conversation
  Briefs cook on what to have ready before clicking the link
  Clicks Send Setup Link
  User account created, token generated with 7 day expiry
  Resend fires minimal magic link email

--- cook gathers their info, clicks link when ready ---

/business-auth/setup/create-password?token=
  Token validated server-side on page load
  If invalid: redirect to /business-auth/setup/expired
  If valid: Neon Auth session created, password form rendered
  Cook sets password, advances to wizard
  If returning after already setting password: skips to last incomplete step

/business-auth/setup/onboarding?step=1
  Profile — display name, photo, bio, cuisine types, dietary tags
  Pre-populated from application
  Save and Continue or Save for Later

/business-auth/setup/onboarding?step=2
  Operations — pickup address, window, prep days, capacity, kitchen type
  Save and Continue or Save for Later

/business-auth/setup/onboarding?step=3
  Compliance — food handler certificate upload, expiry date, safety declaration
  Save and Continue or Save for Later

/business-auth/setup/onboarding?step=4
  Legal and payments — Stripe Connect, commission acknowledgment, ToS
  On submission: setup_complete flagged true

/business-auth/setup/verify-phone
  OTP sent to phone number from application
  Cook enters code
  phone_verified and two_fa_enabled flagged true
  Setup token marked as used, magic link permanently invalidated

/business/dashboard
  Cook is live on the platform
  Prompted to create first weekly menu
```
