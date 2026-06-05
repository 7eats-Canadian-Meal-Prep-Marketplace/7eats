# Client Preference Sheet — Design

**Date:** 2026-06-05
**Branch:** `client-preference-sheet` (off `staging`)
**Status:** Approved

## Problem

Clients set dietary needs, allergies, goals, and "why I order" during onboarding,
stored in the `user_preferences` table. Cooks have no way to see any of this in
`/business` today.

## Goal

Let a cook click a client (from an order or a conversation) and open a read-only
**preference sheet** showing those fields, scoped so a cook can only see clients
they actually do business with.

### Done when
- Click client → sheet with the four fields (or an empty state).
- Cook-only API, only for the cook's own orders/conversations.
- No editing client prefs from the business side.

## Existing-state findings

- The `user_preferences` table is **live in Neon** but **not mirrored in the repo's
  Drizzle schema**. Actual shape:
  - `id` text PK
  - `user_id` text UNIQUE, FK → `user(id)` ON DELETE CASCADE
  - `dietary`, `allergies`, `goals`, `why_meal_prep` — `json`, NOT NULL, arrays of strings
  - `created_at`, `updated_at` timestamps (default `now()`)
  - RLS enabled with two permissive `public` policies (`user_prefs_own`, `user_prefs_admin`).
- Consistent with the existing business APIs (`orders`, `inbox`), the server-side
  Drizzle connection runs as table owner and **enforces scoping in application code**;
  RLS is defense-in-depth for any future direct/edge access.
- A cook is linked to a client through `orders` (`cookId` + `clientId`) and
  `conversations` (`cookId` + `clientId`). Both `clientId` columns reference `user.id` (text).
- Auth helper: `getCookId(req.headers)` in
  `app/api/business/listings/_lib/cook-auth.ts` returns the cook profile id (or null).
- No client-onboarding work is required — the data already exists.

## Approach

Server-side authorization in application code (matching existing orders/inbox APIs),
keyed by **clientId**, with a single shared slide-over component reused by both pages.

Alternatives considered and rejected:
- A generic `/api/users/[id]/preferences` endpoint — too broad, harder to scope to cooks.
- Embedding prefs in existing order/conversation detail payloads — couples unrelated
  concerns and over-fetches when the cook never opens the sheet.

A dedicated, lazily-loaded endpoint keeps the unit isolated and testable.

## 1. Data layer — Drizzle mirror (read-only)

- New `db/schema/user_preferences.ts` mirroring the live table:
  `id` (text PK), `userId` (text, unique, FK → `user.id` `onDelete: "cascade"`),
  `dietary`/`allergies`/`goals`/`whyMealPrep` as `json().$type<string[]>().notNull()`,
  `createdAt`/`updatedAt`. Mirrors existing RLS (`.enableRLS()` + the two permissive
  policies) so schema matches reality.
- Exported from `db/schema/index.ts`.
- **No migration / no `drizzle-kit push` / no `drizzle-kit generate`** — the table
  already exists unchanged and was created out-of-band (so it is absent from Drizzle's
  migration snapshot; `generate` would emit a spurious `CREATE TABLE`). This file only
  provides typed access. Correctness is verified via `tsc`, the full Vitest suite
  (including `schema-review`), and a production build — all green.

## 2. API — cook-scoped read endpoint

`GET /api/business/clients/[clientId]/preferences` (GET only).

1. `getCookId(req.headers)` → `401` if not a cook.
2. **Authorization:** the cook may view this client only if
   `EXISTS(order WHERE cookId ∧ clientId)` **OR**
   `EXISTS(conversation WHERE cookId ∧ clientId)`. Otherwise `403`.
3. Read `user_preferences WHERE userId = clientId`.
4. Respond `{ success: true, data: { dietary, allergies, goals, whyMealPrep, hasPreferences } }`.
   No row → all `[]`, `hasPreferences: false`.

Read-only by construction (only a GET handler) → satisfies "no editing from the
business side."

## 3. Frontend — shared `PreferenceSheet`

- New `app/business/(dashboard)/_components/PreferenceSheet.tsx` (+ `.module.css`),
  a `"use client"` right-side slide-over (dimmed backdrop, X close, Esc-to-close).
- Props: `clientId`, `clientName`, `open`, `onClose`. Fetches on open → loading →
  four labelled sections (Dietary, Allergies, Goals, Why meal prep) rendered as chip
  groups. Per-section "None specified"; whole-sheet "No preferences shared yet" when
  `hasPreferences` is false.
- **Orders** (`orders/page.tsx`): `clientId` already comes from the `[orderId]` detail
  endpoint → add a "Preferences" button next to "Message customer".
- **Inbox** (`inbox/page.tsx`): `conversation.clientId` already present → add a
  "Preferences" button in the thread header.

## 4. Tests (Vitest)

API route tests mirroring `__tests__/orders-status.test.ts` (mock `@/lib/auth`,
`@/db`, `@/db/schema`, `drizzle-orm`):
- `401` — no cook session.
- `403` — cook with no order/conversation link to the client.
- `200` — mapped arrays when linked via an order **or** a conversation.
- `200` — empty state when linked but no `user_preferences` row.

## 5. Out of scope

- Client-side onboarding that writes preferences (data already exists; separate concern).
- Any editing/mutation from the business side.
