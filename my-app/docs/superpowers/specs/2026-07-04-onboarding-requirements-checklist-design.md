# Cook Onboarding: "What's Missing" Requirements Checklist

## Problem

Across the cook onboarding flow (`/business-auth/setup/*`), every step's primary
button ("Save and continue" / "Continue to setup" / "Send code" / "Verify")
uses a "soft-disabled" pattern: it looks disabled (dimmed) when required fields
are incomplete, but the underlying `disabled` attribute only reflects whether a
request is in flight. Clicking it while incomplete runs a `validate()` function
that sets one generic error string (e.g. "Add at least one pickup day.").

This means a cook can stare at a dimmed button with no on-page explanation of
what's missing until they click it, and even then only one issue is surfaced
at a time. The fix: show a live, always-visible list of exactly which
requirements remain unmet, updating as the cook fills in fields.

## Scope

All 6 onboarding steps:

1. Create password (`CreatePasswordForm`)
2. Verify phone (`VerifyPhoneForm`, both phone and code stages)
3. Cook profile (`OnboardingWizard` step 1)
4. Operations (`OnboardingWizard` step 2)
5. Compliance (`OnboardingWizard` step 3)
6. Legal & payments (`OnboardingWizard` step 4)

## Non-goals

- Changing what counts as "complete" for any step (all validation conditions
  stay bit-for-bit identical to what exists today in `validate()` /
  `stepComplete`).
- Moving focus to the first invalid field on submit.
- Highlighting individual invalid inputs (e.g. red outlines).
- Any change to `app/api/setup/**` routes, `db/schema/**`, or submit
  (`advance()`) logic. This is a pure client-rendering addition.
- Making the button truly `disabled` (native attribute). It stays soft-disabled
  (clickable while incomplete), consistent with the existing codebase pattern
  and the "submit stays enabled until request starts" guideline.

## Design

### New component: `app/components/RequirementsChecklist`

A generalization of the existing `PasswordChecklist` component (which stays
untouched, since `SignupForm` and `ResetPasswordForm` also depend on it and
are out of scope here).

```tsx
type RequirementItem = { label: string; met: boolean };

function RequirementsChecklist({
  items,
  touched = true,
}: {
  items: RequirementItem[];
  touched?: boolean;
}): JSX.Element;
```

- Renders a `<ul>` of `<li>` rows, each with a check/X icon (`lucide-react`
  `Check`/`X`, same as `PasswordChecklist`) and the label text.
- `met` rows are green with a checkmark. Unmet rows are neutral gray until
  `touched` is `true`, then muted-red/gray with an X (mirrors
  `PasswordChecklist`'s existing "don't look wrong before the user starts
  typing" behavior).
- No `aria-live` region — matches `PasswordChecklist`'s existing convention.
  A region that changes on every keystroke should not interrupt screen
  readers on every character; `aria-label="What's needed to continue"` on the
  `<ul>` is sufficient for on-demand review.
- Styled via a new `RequirementsChecklist.module.css`, copying the existing
  `PasswordChecklist.module.css` rules (list/item/icon/met/unmet classes).

### `OnboardingWizard` (`app/components/OnboardingWizard/index.tsx`)

Replace the `stepComplete` IIFE (lines 378-415) with a `stepRequirements`
array per step, then derive `stepComplete = stepRequirements.every((r) => r.met)`.
Conditions are copied verbatim from the current `stepComplete`/`validate()`
logic — no semantic changes.

**Step 1 — Cook profile:**
- "Display name added" — `form.displayName.trim() !== ""`
- "Bio is at least 100 characters" (label includes live count, e.g.
  "Bio is at least 100 characters (42/100)") — `bioLen >= 100 && bioLen <= 500`
- "At least 1 cuisine type selected" — `form.cuisines.length > 0`
- "Social link is a valid URL" — only included in the list when
  `form.socialLink.trim() !== ""` (it's optional; an empty field is always
  valid per `isValidOptionalUrl`, so it's not a "requirement" until the cook
  types something invalid) — `isValidOptionalUrl(form.socialLink)`

**Step 2 — Operations:**
- "Valid pickup address selected" — `pickupStreet/City/Province/Postal` all
  non-empty AND `pickupLat`/`pickupLng` not null
- "At least 1 pickup day selected" — only when `offersPickup` —
  `form.pickupDays.length > 0`
- "At least 1 delivery day selected" — only when `offersDelivery` —
  `form.deliveryDays.length > 0`
- "Order lead time selected" — `form.leadTime !== ""`

**Step 3 — Compliance:**
- "Certificate ID number added" — `form.certIdNumber.trim() !== ""`
- "Full name on certificate added" — `form.certFullName.trim() !== ""`
- "Certificate expiry date added" — `form.certExpiry !== ""`

**Step 4 — Legal & payments:**
- "Stripe account connected" — `form.stripeConnected`
- "Terms of service accepted" — `form.tosAccepted`

Render `<RequirementsChecklist items={stepRequirements} />` between the
existing `{stepError && ...}` block and the `.actions` button row.

The existing `stepError` paragraph is unchanged except adding `role="alert"`
so a genuine submit-time failure (e.g. a server error) is still announced —
this is a discrete event, unlike the continuously-updating checklist.

### `CreatePasswordForm` (`app/components/CreatePasswordForm/index.tsx`)

Keep `<PasswordChecklist password={password} />` exactly as-is. Add, directly
below it, a small `RequirementsChecklist` with a single item:

- "Passwords match" — `confirm.length > 0 && confirm === password`,
  `touched={confirm.length > 0}`

### `VerifyPhoneForm` (`app/components/VerifyPhoneForm/index.tsx`)

Add a single-item `RequirementsChecklist` above each stage's button:

- Phone stage: "Valid 10-digit phone number (`${phoneDigits(phone).length}`/10)"
  — `isValidPhone(phone)`, `touched={phone.length > 0}`
- Code stage: "6-digit code entered (`${otp.length}`/6)" —
  `otp.length === 6`, `touched={otp.length > 0}`

## Risk to live data

None. Every file touched is a client component (`"use client"`) or a new
presentational component with no data fetching. No `app/api/setup/**` route,
`db/schema/**`, `validate()`, or `advance()`/submit logic changes. The
underlying conditions that gate `stepComplete` and API submission are
identical before and after — only their visibility to the user changes.

## Testing / verification plan

1. `pnpm exec tsc --noEmit` and `pnpm lint` on touched files.
2. Any existing Vitest coverage touching these components/step validation
   still passes.
3. Manual walkthrough via Playwright MCP on the running dev server: visit
   each of the 6 steps, deliberately leave fields blank/partially filled,
   and screenshot the checklist rendering for visual confirmation before
   calling the task done. Steps gated by external services (OTP delivery,
   Stripe Connect) are exercised only up to the point of showing the
   checklist's empty/partial state — not the full external round trip.
