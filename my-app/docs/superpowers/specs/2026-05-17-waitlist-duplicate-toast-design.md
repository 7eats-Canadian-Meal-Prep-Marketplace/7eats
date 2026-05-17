# Waitlist Duplicate Email Check + Toast Notifications

**Date:** 2026-05-17  
**Branch:** waitlist-frontend  
**Status:** Approved

## Overview

Add duplicate email detection to the waitlist signup flow and replace the current silent error/button-swap feedback with Sonner toast notifications styled to match the app's design system.

## Problem

- The API silently accepts duplicate emails (DB uses `onConflictDoNothing`) and always returns 200 — the user gets no feedback that they're already registered.
- Frontend errors are only logged to the console; users see nothing when signup fails.
- Success feedback is a button text swap that resets after 2.4s — easy to miss.

## Backend Changes

### `lib/waitlist.ts`

Change `addToWaitlist` return type from `Promise<void>` to `Promise<boolean>`:
- Use `.returning()` on the Drizzle insert to detect whether a row was actually inserted.
- Return `true` if a new row was inserted (empty conflict), `false` if the email already existed (conflict fired, no rows returned).

### `app/api/waitlist/route.ts`

Check the return value of `addToWaitlist`:
- `true` (new insert) → `200 ok("You're on the list!")`
- `false` (duplicate) → `409 fail("You're already on the list.")`

All existing logic (rate limiting, validation, body size guard, error handling) is unchanged.

## Frontend Changes

### `app/components/CtaSection.tsx`

Remove the `status` state and button text swap entirely. Replace with Sonner `toast` calls in `handleSubmit`:

| HTTP Status | Toast type | Message |
|-------------|-----------|---------|
| 200 | success | "You're on the list!" |
| 409 | info | "You're already on the list." |
| 429 | error | "Too many attempts. Try again later." |
| other | error | "Something went wrong. Please try again." |

- On 200 or 409: clear the email input.
- On error: keep the email input populated so the user doesn't lose it.
- Button always shows "Notify me".

### `app/layout.tsx`

Add `<Toaster position="top-center" />` with `toastOptions` using the app's CSS variables:
- Background: `var(--ink-2)` (#1a1a1a)
- Text: `var(--white)`
- Success color: `var(--red)` (#d64045)
- Border-radius: `var(--radius-sm)` (8px)
- Font: `var(--font)` (Plus Jakarta Sans)

## Dependencies

Install `sonner` via pnpm.

## Error Handling

- All existing server-side error handling (rate limit, validation, body size) is preserved.
- The frontend gracefully handles any unexpected status code with a generic error toast.
- Network-level failures (fetch throws) should also show an error toast — wrap the fetch in try/catch.

## Out of Scope

- Email confirmation / double opt-in
- Unsubscribe flow
- Admin visibility into duplicate attempts
