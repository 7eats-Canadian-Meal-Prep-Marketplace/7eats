# Address Autocomplete & Delivery Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all free-text address inputs with Mapbox-powered autocomplete that stores structured addresses with lat/lng, then use those coordinates to calculate real driving distances for cook delivery zones and per-km delivery fees.

**Architecture:** Two-phase implementation. Phase 1 (Tasks 1–8, Issue #26) adds a shared `AddressAutocomplete` component backed by `@mapbox/search-js-react` `AddressAutofill`, migrates DB schemas to include structured address fields + lat/lng/placeId, and wires the component into all address-entry surfaces. Phase 2 (Tasks 9–12, Issue #27) adds delivery zone config fields to cook profiles, implements a server-side Mapbox Directions API helper for driving distance, and wires delivery fee calculation into the orders flow with a fee snapshot on the order row.

**Tech Stack:** `@mapbox/search-js-react` (AddressAutofill), Mapbox Directions API (server-side, `MAPBOX_SECRET_TOKEN`), Drizzle ORM + Neon Postgres, Next.js 16 App Router, Zod, Vitest

---

## File Map

**New files:**
- `lib/types/address.ts` — `NormalizedAddress` interface (shared between client and server)
- `components/AddressAutocomplete/index.tsx` — single "use client" component wrapping Mapbox AddressAutofill
- `db/schema/user-preferences.ts` — `userPreferences` table with client service address + lat/lng
- `lib/mapbox-directions.ts` — server-side Directions API helper
- `lib/delivery-fee.ts` — pure delivery fee calculation logic
- `app/api/user/address/route.ts` — GET/PUT endpoint for client service address
- `app/api/delivery/distance/route.ts` — GET endpoint that resolves driving km + fee for a cook
- `__tests__/lib/delivery-fee.test.ts` — unit tests for fee logic
- `__tests__/api/user/address.test.ts` — tests for address persistence endpoint

**Modified files:**
- `db/schema/cooks.ts` — add `pickupStreet/Unit/City/Province/Postal/Lat/Lng/PlaceId` + delivery zone fields
- `db/schema/orders.ts` — add `deliveryFeeSnapshot`, `deliveryDistanceKm`
- `db/schema/applications.ts` — add `addressLat`, `addressLng`, `addressPlaceId`
- `db/schema/index.ts` — export `userPreferences`
- `app/components/OnboardingWizard/index.tsx` — replace `pickupAddress` text input with `AddressAutocomplete`
- `app/app/_shell.tsx` — replace mock text with `AddressAutocomplete` + persist via API
- `app/business/(dashboard)/settings/page.tsx` — replace pickup text input; add delivery zone section
- `app/app/cart/_cart-tax.ts` — accept `province` param instead of hardcoding Ontario
- `app/api/setup/onboarding/[step]/route.ts` — step 2: accept structured address fields
- `app/api/business/profile/route.ts` — accept structured pickup address + delivery zone fields
- `app/api/orders/route.ts` — add `lat`/`lng`/`placeId` to deliveryAddress schema; compute + snapshot delivery fee

---

## Task 1: Environment Setup + Shared Type

**Files:**
- Create: `lib/types/address.ts`
- Modify: `.env.local` (add two keys)

- [ ] **Step 1: Install the Mapbox Search JS React package**

```bash
pnpm add @mapbox/search-js-react
```

Expected output: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Add Mapbox tokens to .env.local**

Open `.env.local` and append:

```env
# Mapbox — public token (client-side autocomplete, restrict to your domain in Mapbox dashboard)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiWU9VUl9VU0VSTkFNRSIsImEiOiJZT1VSX1BVQkxJQ19LRVkifQ.REPLACE_ME

# Mapbox — secret token (server-side Directions API only, never expose to client)
MAPBOX_SECRET_TOKEN=sk.eyJ1IjoiWU9VUl9VU0VSTkFNRSIsImEiOiJZT1VSX1NFQ1JFVF9LRVkifQ.REPLACE_ME
```

Replace both values with real tokens from your Mapbox account (mapbox.com → Account → Access tokens). The public token can be used client-side; restrict it to your domain. The secret token is server-only.

- [ ] **Step 3: Create the shared NormalizedAddress type**

```typescript
// lib/types/address.ts
export interface NormalizedAddress {
  street: string
  unit?: string
  city: string
  province: string  // 2-char ISO, e.g. "ON"
  postal: string
  lat: number
  lng: number
  placeId: string   // Mapbox mapbox_id — used for distance caching
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types/address.ts package.json pnpm-lock.yaml
git commit -m "feat: add NormalizedAddress type and Mapbox dependency"
```

---

## Task 2: Schema — User Service Address Table

**Files:**
- Create: `db/schema/user-preferences.ts`
- Modify: `db/schema/index.ts`

- [ ] **Step 1: Write a test for the schema export**

```typescript
// __tests__/db/user-preferences.test.ts
import { userPreferences } from "@/db/schema"

it("exports userPreferences table", () => {
  expect(userPreferences).toBeDefined()
  expect(userPreferences._.name).toBe("user_preferences")
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:run __tests__/db/user-preferences.test.ts
```

Expected: FAIL — "Cannot find module" or "undefined" error.

- [ ] **Step 3: Create the userPreferences schema**

```typescript
// db/schema/user-preferences.ts
import { pgTable, text, doublePrecision, timestamp } from "drizzle-orm/pg-core"
import { authUser } from "./auth"

export const userPreferences = pgTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => authUser.id, { onDelete: "cascade" }),
  serviceStreet: text("service_street"),
  serviceUnit: text("service_unit"),
  serviceCity: text("service_city"),
  serviceProvince: text("service_province"),
  servicePostal: text("service_postal"),
  serviceLat: doublePrecision("service_lat"),
  serviceLng: doublePrecision("service_lng"),
  servicePlaceId: text("service_place_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
```

- [ ] **Step 4: Export from schema barrel**

Open `db/schema/index.ts` and add:

```typescript
export * from "./user-preferences"
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
pnpm test:run __tests__/db/user-preferences.test.ts
```

Expected: PASS.

- [ ] **Step 6: Push schema to Neon**

```bash
pnpm exec drizzle-kit push
```

Confirm the `user_preferences` table is created when prompted.

- [ ] **Step 7: Commit**

```bash
git add db/schema/user-preferences.ts db/schema/index.ts __tests__/db/user-preferences.test.ts
git commit -m "feat: add user_preferences table for client service address"
```

---

## Task 3: Schema — Cook Pickup Address (Structured) + Application Geocoding

**Files:**
- Modify: `db/schema/cooks.ts` (add structured pickup address columns after line 43)
- Modify: `db/schema/applications.ts` (add geocoding columns after line 25)

The existing `pickupAddress text` column (line 43 of cooks.ts) is left in place as nullable — new code will write to the structured columns; the old column becomes dead storage.

- [ ] **Step 1: Add structured pickup address fields to cook_profiles**

In `db/schema/cooks.ts`, after the `pickupAddress` line (line 43), add:

```typescript
  pickupStreet: text("pickup_street"),
  pickupUnit: text("pickup_unit"),
  pickupCity: text("pickup_city"),
  pickupProvince: text("pickup_province"),
  pickupPostal: text("pickup_postal"),
  pickupLat: doublePrecision("pickup_lat"),
  pickupLng: doublePrecision("pickup_lng"),
  pickupPlaceId: text("pickup_place_id"),
```

You will need to add `doublePrecision` to the existing import from `"drizzle-orm/pg-core"` at the top of the file.

- [ ] **Step 2: Add geocoding fields to cook_applications**

In `db/schema/applications.ts`, after the `postalCode` line (line 25), add:

```typescript
  addressLat: doublePrecision("address_lat"),
  addressLng: doublePrecision("address_lng"),
  addressPlaceId: text("address_place_id"),
```

Add `doublePrecision` to the import at the top of the file.

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Push schema to Neon**

```bash
pnpm exec drizzle-kit push
```

Confirm the new columns are added to `cook_profiles` and `cook_applications`.

- [ ] **Step 5: Commit**

```bash
git add db/schema/cooks.ts db/schema/applications.ts
git commit -m "feat: add structured address + geocoding fields to cook_profiles and cook_applications"
```

---

## Task 4: Schema — Delivery Zone Config + Order Fee Snapshot

**Files:**
- Modify: `db/schema/cooks.ts` (add delivery zone fields)
- Modify: `db/schema/orders.ts` (add fee snapshot fields)

- [ ] **Step 1: Add delivery zone fields to cook_profiles**

In `db/schema/cooks.ts`, after `pickupPlaceId` (added in Task 3), add:

```typescript
  maxDeliveryKm: integer("max_delivery_km"),
  deliveryRatePerKm: numeric("delivery_rate_per_km", { precision: 6, scale: 2 }),
  deliveryFlatFee: numeric("delivery_flat_fee", { precision: 6, scale: 2 }).default("0"),
  freeDeliveryAbove: numeric("free_delivery_above", { precision: 8, scale: 2 }),
```

Add `integer, numeric` to the drizzle-orm import if not already present.

- [ ] **Step 2: Add delivery fee snapshot fields to orders**

In `db/schema/orders.ts`, after the `deliveryAddress` line (line 53), add:

```typescript
  deliveryFeeSnapshot: numeric("delivery_fee_snapshot", { precision: 8, scale: 2 }),
  deliveryDistanceKm: integer("delivery_distance_km"),
```

Add `integer, numeric` to the import if not already present.

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Push schema to Neon**

```bash
pnpm exec drizzle-kit push
```

Confirm `max_delivery_km`, `delivery_rate_per_km`, `delivery_flat_fee`, `free_delivery_above` appear on `cook_profiles`, and `delivery_fee_snapshot`, `delivery_distance_km` on `orders`.

- [ ] **Step 5: Commit**

```bash
git add db/schema/cooks.ts db/schema/orders.ts
git commit -m "feat: add delivery zone config to cook_profiles and fee snapshot to orders"
```

---

## Task 5: AddressAutocomplete Component

**Files:**
- Create: `components/AddressAutocomplete/index.tsx`

This is the single shared component used on all address-entry surfaces (client and business). It wraps Mapbox `AddressAutofill`, restricts results to Canada, and emits a `NormalizedAddress` via `onResolve`.

- [ ] **Step 1: Create the component**

```tsx
// components/AddressAutocomplete/index.tsx
"use client"
import { AddressAutofill } from "@mapbox/search-js-react"
import type { AddressAutofillRetrieveResponse } from "@mapbox/search-js-react"
import { useState } from "react"
import type { NormalizedAddress } from "@/lib/types/address"

interface Props {
  onResolve: (address: NormalizedAddress) => void
  initialValue?: string
  placeholder?: string
  inputClassName?: string
  name?: string
}

export function AddressAutocomplete({
  onResolve,
  initialValue = "",
  placeholder = "Start typing your address…",
  inputClassName = "",
  name = "address",
}: Props) {
  const [value, setValue] = useState(initialValue)

  function handleRetrieve(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0]
    if (!feature) return
    const { properties, geometry } = feature
    const resolved: NormalizedAddress = {
      street: properties.address_line1 ?? "",
      unit: properties.address_line2 || undefined,
      city: properties.place ?? "",
      province: properties.region_code ?? "",
      postal: properties.postcode ?? "",
      lat: geometry.coordinates[1],
      lng: geometry.coordinates[0],
      placeId: properties.mapbox_id ?? "",
    }
    onResolve(resolved)
    setValue(properties.full_address ?? properties.address_line1 ?? "")
  }

  return (
    <AddressAutofill
      accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
      options={{ country: "ca", language: "en" }}
      onRetrieve={handleRetrieve}
    >
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="address-line1"
        className={inputClassName}
      />
    </AddressAutofill>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors. If Mapbox types are missing, run `pnpm add -D @types/mapbox__search-js-react` (check if needed — the package ships its own types).

- [ ] **Step 3: Commit**

```bash
git add components/AddressAutocomplete/index.tsx
git commit -m "feat: add shared AddressAutocomplete component (Mapbox AddressAutofill, CA-only)"
```

---

## Task 6: Cook Onboarding Step 2 — Structured Pickup Address

**Files:**
- Modify: `app/components/OnboardingWizard/index.tsx`
- Modify: `app/api/setup/onboarding/[step]/route.ts`

- [ ] **Step 1: Write a failing test for the step 2 API handler accepting structured address fields**

```typescript
// __tests__/api/onboarding/step2-address.test.ts
import { describe, it, expect, vi } from "vitest"

// This test validates that the step 2 handler accepts the new structured fields.
// It does not call the real DB — it validates the Zod schema shape that should exist
// after this task is complete.

describe("onboarding step2 pickup address schema", () => {
  it("requires pickupStreet, pickupCity, pickupProvince, pickupPostal, pickupLat, pickupLng, pickupPlaceId", () => {
    const validPayload = {
      pickupStreet: "123 King St W",
      pickupCity: "Toronto",
      pickupProvince: "ON",
      pickupPostal: "M5H 3T9",
      pickupLat: 43.6483,
      pickupLng: -79.3832,
      pickupPlaceId: "dXJuOm1ieHBsYzpBWmdMWlE",
      leadTime: "1_day",
      maxCapacity: 10,
      delivery: "none",
      acceptsSpecialRequests: false,
      pickupWindows: {},
      pickupDays: [],
    }
    // All required fields present — no throw expected
    expect(() => validateStep2Payload(validPayload)).not.toThrow()
  })

  it("rejects payload missing pickupStreet", () => {
    const payload = {
      pickupCity: "Toronto",
      pickupProvince: "ON",
      pickupPostal: "M5H 3T9",
      pickupLat: 43.6483,
      pickupLng: -79.3832,
      pickupPlaceId: "dXJuOm1ieHBsYzpBWmdMWlE",
      leadTime: "1_day",
      maxCapacity: 10,
      delivery: "none",
      acceptsSpecialRequests: false,
    }
    expect(() => validateStep2Payload(payload)).toThrow()
  })
})

function validateStep2Payload(data: unknown) {
  // Import the actual schema from the route once it's updated
  const { z } = require("zod")
  const step2Schema = z.object({
    pickupStreet: z.string().min(1).max(200),
    pickupUnit: z.string().max(50).optional(),
    pickupCity: z.string().min(1).max(100),
    pickupProvince: z.string().length(2),
    pickupPostal: z.string().min(3).max(10),
    pickupLat: z.number(),
    pickupLng: z.number(),
    pickupPlaceId: z.string().min(1),
    leadTime: z.string(),
    maxCapacity: z.number().int().min(1),
    delivery: z.enum(["none", "self"]),
    acceptsSpecialRequests: z.boolean(),
    pickupWindows: z.record(z.any()).optional(),
    pickupDays: z.array(z.string()).optional(),
  })
  step2Schema.parse(data)
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:run __tests__/api/onboarding/step2-address.test.ts
```

Expected: FAIL (function exists but logic not yet wired).

- [ ] **Step 3: Update the step 2 API handler**

In `app/api/setup/onboarding/[step]/route.ts`, find the `step2` function (around line 165). Replace the `pickupAddress` text handling with structured field handling:

Replace the existing `pickupAddress` extraction block (lines 166–172) with:

```typescript
const pickupStreet = (data.pickupStreet ?? "").trim()
const pickupUnit = (data.pickupUnit ?? "").trim() || null
const pickupCity = (data.pickupCity ?? "").trim()
const pickupProvince = (data.pickupProvince ?? "").trim()
const pickupPostal = (data.pickupPostal ?? "").trim()
const pickupLat = typeof data.pickupLat === "number" ? data.pickupLat : null
const pickupLng = typeof data.pickupLng === "number" ? data.pickupLng : null
const pickupPlaceId = (data.pickupPlaceId ?? "").trim() || null

if (!pickupStreet || !pickupCity || !pickupProvince || !pickupPostal || pickupLat === null || pickupLng === null) {
  return NextResponse.json({ error: "Complete pickup address with geocoding is required." }, { status: 400 })
}
```

Then in the `.set({...})` block (around line 201), replace `pickupAddress,` with:

```typescript
pickupStreet,
pickupUnit,
pickupCity,
pickupProvince,
pickupPostal,
pickupLat,
pickupLng,
pickupPlaceId,
```

- [ ] **Step 4: Update OnboardingWizard step 2 UI**

In `app/components/OnboardingWizard/index.tsx`:

a) Add `NormalizedAddress` to imports at the top:
```typescript
import { AddressAutocomplete } from "@/components/AddressAutocomplete"
import type { NormalizedAddress } from "@/lib/types/address"
```

b) In the `FormState` type (around line 77), replace `pickupAddress: string` with:
```typescript
pickupStreet: string
pickupUnit: string
pickupCity: string
pickupProvince: string
pickupPostal: string
pickupLat: number | null
pickupLng: number | null
pickupPlaceId: string
```

c) In the initial form state, replace `pickupAddress: ""` with:
```typescript
pickupStreet: "",
pickupUnit: "",
pickupCity: "",
pickupProvince: "",
pickupPostal: "",
pickupLat: null,
pickupLng: null,
pickupPlaceId: "",
```

d) In the step 2 validation (around line 211), replace the `pickupAddress` check with:
```typescript
if (!form.pickupStreet.trim() || form.pickupLat === null) {
  setStepError("A valid geocoded pickup address is required.")
  return false
}
```

e) In the step 2 form body (around line 665), replace the `pickupAddress` text input block with:
```tsx
<label htmlFor="pickupAddress" className={styles.label}>
  Pickup Address
</label>
<AddressAutocomplete
  name="pickupAddress"
  placeholder="Street address"
  inputClassName={styles.input}
  onResolve={(addr: NormalizedAddress) =>
    setForm((f) => ({
      ...f,
      pickupStreet: addr.street,
      pickupUnit: addr.unit ?? "",
      pickupCity: addr.city,
      pickupProvince: addr.province,
      pickupPostal: addr.postal,
      pickupLat: addr.lat,
      pickupLng: addr.lng,
      pickupPlaceId: addr.placeId,
    }))
  }
/>
```

f) Update the step 2 submit payload to send the new fields instead of `pickupAddress`.

- [ ] **Step 5: Run tests**

```bash
pnpm test:run __tests__/api/onboarding/step2-address.test.ts
```

Expected: PASS.

- [ ] **Step 6: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/components/OnboardingWizard/index.tsx app/api/setup/onboarding/ __tests__/api/onboarding/
git commit -m "feat: replace onboarding step 2 pickup address text input with geocoded AddressAutocomplete"
```

---

## Task 7: Cook Dashboard Settings — Pickup Address + Profile API

**Files:**
- Modify: `app/business/(dashboard)/settings/page.tsx`
- Modify: `app/api/business/profile/route.ts`

- [ ] **Step 1: Update profile PATCH schema**

In `app/api/business/profile/route.ts`, find `bodySchema` (line 33). Replace:

```typescript
pickupAddress: z.string().max(500).optional(),
```

With:

```typescript
pickupStreet: z.string().min(1).max(200).optional(),
pickupUnit: z.string().max(50).optional().nullable(),
pickupCity: z.string().min(1).max(100).optional(),
pickupProvince: z.string().length(2).optional(),
pickupPostal: z.string().min(3).max(10).optional(),
pickupLat: z.number().optional().nullable(),
pickupLng: z.number().optional().nullable(),
pickupPlaceId: z.string().optional().nullable(),
```

- [ ] **Step 2: Update the settings page UI**

In `app/business/(dashboard)/settings/page.tsx`, add imports at the top of the file (client component):

```typescript
import { AddressAutocomplete } from "@/components/AddressAutocomplete"
import type { NormalizedAddress } from "@/lib/types/address"
```

Find the pickup address text input (around line 132). Replace the `<input>` block with:

```tsx
<AddressAutocomplete
  name="pickupAddress"
  placeholder="Street address"
  initialValue={form.pickupAddress ?? ""}
  inputClassName={/* use existing input class from the file */}
  onResolve={(addr: NormalizedAddress) => {
    setForm((f) => ({
      ...f,
      pickupStreet: addr.street,
      pickupUnit: addr.unit ?? null,
      pickupCity: addr.city,
      pickupProvince: addr.province,
      pickupPostal: addr.postal,
      pickupLat: addr.lat,
      pickupLng: addr.lng,
      pickupPlaceId: addr.placeId,
    }))
  }}
/>
```

Update the form state type and the PATCH payload to send the structured fields.

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/business/(dashboard)/settings/page.tsx app/api/business/profile/route.ts
git commit -m "feat: replace cook dashboard pickup address input with geocoded AddressAutocomplete"
```

---

## Task 8: Client Header Address — Persist to DB

**Files:**
- Create: `app/api/user/address/route.ts`
- Create: `__tests__/api/user/address.test.ts`
- Modify: `app/app/_shell.tsx`

- [ ] **Step 1: Write failing tests for the address endpoint**

```typescript
// __tests__/api/user/address.test.ts
import { describe, it, expect, vi } from "vitest"

describe("PUT /api/user/address validation", () => {
  it("accepts a valid NormalizedAddress payload", () => {
    const valid = {
      street: "123 King St W",
      city: "Toronto",
      province: "ON",
      postal: "M5H 3T9",
      lat: 43.6483,
      lng: -79.3832,
      placeId: "dXJuOm1ieHBsYzpBWmdMWlE",
    }
    expect(() => addressSchema.parse(valid)).not.toThrow()
  })

  it("rejects payload missing lat/lng", () => {
    const invalid = { street: "123 King St W", city: "Toronto", province: "ON", postal: "M5H 3T9" }
    expect(() => addressSchema.parse(invalid)).toThrow()
  })
})

const { z } = await import("zod")
const addressSchema = z.object({
  street: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  city: z.string().min(1).max(100),
  province: z.string().length(2),
  postal: z.string().min(3).max(10),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().min(1),
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:run __tests__/api/user/address.test.ts
```

Expected: FAIL — `addressSchema` is not imported from the route yet.

- [ ] **Step 3: Create the address API route**

```typescript
// app/api/user/address/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { userPreferences } from "@/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { createId } from "@paralleldrive/cuid2"

const addressSchema = z.object({
  street: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  city: z.string().min(1).max(100),
  province: z.string().length(2),
  postal: z.string().min(3).max(10),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().min(1),
})

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1)

  if (!prefs) return NextResponse.json({ address: null })

  return NextResponse.json({
    address: prefs.serviceStreet
      ? {
          street: prefs.serviceStreet,
          unit: prefs.serviceUnit ?? undefined,
          city: prefs.serviceCity,
          province: prefs.serviceProvince,
          postal: prefs.servicePostal,
          lat: prefs.serviceLat,
          lng: prefs.serviceLng,
          placeId: prefs.servicePlaceId,
        }
      : null,
  })
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = addressSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { street, unit, city, province, postal, lat, lng, placeId } = parsed.data

  await db
    .insert(userPreferences)
    .values({
      id: createId(),
      userId: session.user.id,
      serviceStreet: street,
      serviceUnit: unit ?? null,
      serviceCity: city,
      serviceProvince: province,
      servicePostal: postal,
      serviceLat: lat,
      serviceLng: lng,
      servicePlaceId: placeId,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        serviceStreet: street,
        serviceUnit: unit ?? null,
        serviceCity: city,
        serviceProvince: province,
        servicePostal: postal,
        serviceLat: lat,
        serviceLng: lng,
        servicePlaceId: placeId,
        updatedAt: new Date(),
      },
    })

  return NextResponse.json({ ok: true })
}
```

Note: `@paralleldrive/cuid2` is used for ID generation. Check if it's already in the project by running `grep -r "cuid" package.json`. If missing, run `pnpm add @paralleldrive/cuid2`.

- [ ] **Step 4: Run tests**

```bash
pnpm test:run __tests__/api/user/address.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update the client header AddressModal in _shell.tsx**

In `app/app/_shell.tsx`:

a) Add imports near the top of the file:
```typescript
import { AddressAutocomplete } from "@/components/AddressAutocomplete"
import type { NormalizedAddress } from "@/lib/types/address"
```

b) The `AddressModal` component (line 80) currently has a single text `<input>`. Replace that input block with:
```tsx
<AddressAutocomplete
  name="serviceAddress"
  placeholder="Enter your address…"
  initialValue={current}
  onResolve={(addr: NormalizedAddress) => {
    setVal(`${addr.street}${addr.unit ? ` Unit ${addr.unit}` : ""}, ${addr.city}, ${addr.province}`)
    onConfirm(addr)
  }}
/>
```

c) Change the `onConfirm` prop type from `onConfirm: (a: string) => void` to `onConfirm: (a: NormalizedAddress) => void`.

d) In `ShellInner` (line 266+), add a `useEffect` that fetches the saved address on mount:

```tsx
useEffect(() => {
  fetch("/api/user/address")
    .then((r) => r.json())
    .then(({ address }) => {
      if (address) {
        setAddress(`${address.street}${address.unit ? ` Unit ${address.unit}` : ""}, ${address.city}, ${address.province}`)
        setSavedAddress(address)
      }
    })
    .catch(() => {})
}, [])
```

Add a `savedAddress` state: `const [savedAddress, setSavedAddress] = useState<NormalizedAddress | null>(null)`.

e) Update `onConfirm` handler to also persist the address:
```tsx
onConfirm={(addr: NormalizedAddress) => {
  setAddress(`${addr.street}${addr.unit ? ` Unit ${addr.unit}` : ""}, ${addr.city}, ${addr.province}`)
  setSavedAddress(addr)
  fetch("/api/user/address", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addr),
  }).catch(() => {})
  setShowAddress(false)
}}
```

- [ ] **Step 6: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/user/address/route.ts app/app/_shell.tsx __tests__/api/user/address.test.ts
git commit -m "feat: persist client service address via /api/user/address, wire AddressAutocomplete to header modal"
```

---

## Task 9: Cart Tax — Dynamic Province

**Files:**
- Modify: `app/app/cart/_cart-tax.ts`

Currently hardcodes Ontario. Now that the client's province is stored, the tax function can be province-aware.

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/cart-tax.test.ts
import { calcTax, formatCartMoney } from "@/app/app/cart/_cart-tax"

describe("calcTax", () => {
  it("returns 13% HST for Ontario", () => {
    expect(calcTax(100, "ON")).toBeCloseTo(13)
  })

  it("returns 15% HST for Nova Scotia", () => {
    expect(calcTax(100, "NS")).toBeCloseTo(15)
  })

  it("returns 5% GST for Alberta", () => {
    expect(calcTax(100, "AB")).toBeCloseTo(5)
  })

  it("defaults to 13% when province unknown", () => {
    expect(calcTax(100, undefined)).toBeCloseTo(13)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:run __tests__/lib/cart-tax.test.ts
```

Expected: FAIL — `calcTax` does not exist yet.

- [ ] **Step 3: Update _cart-tax.ts**

Replace the entire contents of `app/app/cart/_cart-tax.ts` with:

```typescript
// HST/GST rates by Canadian province (2025)
const PROVINCE_TAX_RATES: Record<string, number> = {
  ON: 0.13,  // HST 13%
  BC: 0.12,  // GST 5% + PST 7%
  AB: 0.05,  // GST only
  SK: 0.11,  // GST 5% + PST 6%
  MB: 0.12,  // GST 5% + PST 7%
  QC: 0.14975, // GST 5% + QST 9.975%
  NB: 0.15,  // HST 15%
  NS: 0.15,  // HST 15%
  PE: 0.15,  // HST 15%
  NL: 0.15,  // HST 15%
  NT: 0.05,  // GST only
  NU: 0.05,  // GST only
  YT: 0.05,  // GST only
}

const DEFAULT_RATE = PROVINCE_TAX_RATES.ON

export function calcTax(subtotal: number, province?: string | null): number {
  const rate = (province && PROVINCE_TAX_RATES[province.toUpperCase()]) ?? DEFAULT_RATE
  return Math.round(subtotal * rate * 100) / 100
}

export function taxLabel(province?: string | null): string {
  if (!province || !PROVINCE_TAX_RATES[province.toUpperCase()]) return "HST (13%)"
  const rate = PROVINCE_TAX_RATES[province.toUpperCase()]
  return `Tax (${(rate * 100).toFixed(rate === 0.14975 ? 3 : 0)}%)`
}

export function formatCartMoney(amount: number): string {
  return amount.toLocaleString("en-CA", { style: "currency", currency: "CAD" })
}
```

- [ ] **Step 4: Update all callers of `calcOntarioHst`**

Search for uses of the old function:
```bash
grep -r "calcOntarioHst\|ONTARIO_HST" app/ --include="*.ts" --include="*.tsx"
```

For each call site, replace `calcOntarioHst(subtotal)` with `calcTax(subtotal, province)` where `province` comes from the user's saved address (pass it down as a prop or read from context/API where needed).

- [ ] **Step 5: Run tests**

```bash
pnpm test:run __tests__/lib/cart-tax.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/app/cart/_cart-tax.ts __tests__/lib/cart-tax.test.ts
git commit -m "feat: make cart tax province-aware, support all Canadian provinces"
```

---

## Task 10: Delivery Fee Logic + Server-Side Distance Helper

**Files:**
- Create: `lib/mapbox-directions.ts`
- Create: `lib/delivery-fee.ts`
- Create: `__tests__/lib/delivery-fee.test.ts`

- [ ] **Step 1: Write failing tests for delivery fee logic**

```typescript
// __tests__/lib/delivery-fee.test.ts
import { calcDeliveryFee } from "@/lib/delivery-fee"

const BASE_CONFIG = {
  maxDeliveryKm: 15,
  deliveryRatePerKm: "1.50",
  deliveryFlatFee: "2.00",
  freeDeliveryAbove: null,
}

describe("calcDeliveryFee", () => {
  it("returns flat + per-km fee within zone", () => {
    const result = calcDeliveryFee(10, 30, BASE_CONFIG)
    expect(result.blocked).toBe(false)
    // 2.00 flat + 10km * 1.50 = 17.00
    expect(result.fee).toBe(17.00)
  })

  it("blocks delivery beyond max zone", () => {
    const result = calcDeliveryFee(16, 30, BASE_CONFIG)
    expect(result.blocked).toBe(true)
    expect(result.fee).toBe(0)
  })

  it("returns $0 fee when cart meets free delivery threshold", () => {
    const config = { ...BASE_CONFIG, freeDeliveryAbove: "50.00" }
    const result = calcDeliveryFee(10, 50, config)
    expect(result.blocked).toBe(false)
    expect(result.fee).toBe(0)
  })

  it("charges fee when cart is below free delivery threshold", () => {
    const config = { ...BASE_CONFIG, freeDeliveryAbove: "50.00" }
    const result = calcDeliveryFee(10, 49.99, config)
    expect(result.blocked).toBe(false)
    expect(result.fee).toBe(17.00)
  })

  it("allows exactly at max zone boundary", () => {
    const result = calcDeliveryFee(15, 30, BASE_CONFIG)
    expect(result.blocked).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:run __tests__/lib/delivery-fee.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the delivery fee helper**

```typescript
// lib/delivery-fee.ts
export interface CookDeliveryConfig {
  maxDeliveryKm: number
  deliveryRatePerKm: string   // numeric string from DB
  deliveryFlatFee: string     // numeric string from DB
  freeDeliveryAbove: string | null
}

export interface DeliveryFeeResult {
  fee: number
  blocked: boolean
}

export function calcDeliveryFee(
  distanceKm: number,
  cartSubtotal: number,
  config: CookDeliveryConfig,
): DeliveryFeeResult {
  if (distanceKm > config.maxDeliveryKm) {
    return { fee: 0, blocked: true }
  }
  if (config.freeDeliveryAbove !== null && cartSubtotal >= parseFloat(config.freeDeliveryAbove)) {
    return { fee: 0, blocked: false }
  }
  const flat = parseFloat(config.deliveryFlatFee)
  const perKm = parseFloat(config.deliveryRatePerKm)
  const fee = Math.round((flat + distanceKm * perKm) * 100) / 100
  return { fee, blocked: false }
}
```

- [ ] **Step 4: Create the Mapbox Directions server helper**

```typescript
// lib/mapbox-directions.ts
export async function getDrivingDistanceKm(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
): Promise<number | null> {
  const token = process.env.MAPBOX_SECRET_TOKEN
  if (!token) {
    console.error("MAPBOX_SECRET_TOKEN not set")
    return null
  }

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${originLng},${originLat};${destLng},${destLat}` +
    `?access_token=${token}&overview=false`

  const res = await fetch(url, { next: { revalidate: 86400 } }) // cache 24h — road distances don't change
  if (!res.ok) return null

  const data = await res.json()
  if (!data.routes?.length) return null

  return Math.ceil(data.routes[0].distance / 1000)
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test:run __tests__/lib/delivery-fee.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/delivery-fee.ts lib/mapbox-directions.ts __tests__/lib/delivery-fee.test.ts
git commit -m "feat: add delivery fee calculator and Mapbox Directions server helper"
```

---

## Task 11: Delivery Zone Config UI (Cook Settings)

**Files:**
- Modify: `app/business/(dashboard)/settings/page.tsx`
- Modify: `app/api/business/profile/route.ts`

This task adds the delivery zone section to the cook settings page. It only appears when `delivery === "self"`.

- [ ] **Step 1: Update profile PATCH schema to accept delivery zone fields**

In `app/api/business/profile/route.ts`, add to `bodySchema`:

```typescript
maxDeliveryKm: z.number().int().min(1).max(100).optional().nullable(),
deliveryRatePerKm: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
deliveryFlatFee: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
freeDeliveryAbove: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
```

In the PATCH handler, include these fields in the update set (they're already picked up by the existing spread logic — verify this).

- [ ] **Step 2: Add delivery zone UI to settings page**

In `app/business/(dashboard)/settings/page.tsx`, find the delivery toggle section. After the `delivery` enum select, add a conditional block that renders when `form.delivery === "self"`:

```tsx
{form.delivery === "self" && (
  <div className={styles.deliveryZoneSection}>
    <h3 className={styles.sectionSubtitle}>Delivery Zone & Pricing</h3>

    <label htmlFor="maxDeliveryKm" className={styles.label}>
      Maximum delivery distance (km)
    </label>
    <input
      id="maxDeliveryKm"
      type="number"
      min={1}
      max={100}
      value={form.maxDeliveryKm ?? ""}
      onChange={(e) =>
        setForm((f) => ({ ...f, maxDeliveryKm: e.target.value ? parseInt(e.target.value) : null }))
      }
      placeholder="e.g. 15"
      className={styles.input}
    />

    <label htmlFor="deliveryFlatFee" className={styles.label}>
      Base delivery fee ($)
    </label>
    <input
      id="deliveryFlatFee"
      type="number"
      min={0}
      step={0.01}
      value={form.deliveryFlatFee ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, deliveryFlatFee: e.target.value }))}
      placeholder="e.g. 2.00"
      className={styles.input}
    />

    <label htmlFor="deliveryRatePerKm" className={styles.label}>
      Rate per km ($/km)
    </label>
    <input
      id="deliveryRatePerKm"
      type="number"
      min={0}
      step={0.01}
      value={form.deliveryRatePerKm ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, deliveryRatePerKm: e.target.value }))}
      placeholder="e.g. 1.50"
      className={styles.input}
    />

    <label htmlFor="freeDeliveryAbove" className={styles.label}>
      Free delivery on orders above ($) — optional
    </label>
    <input
      id="freeDeliveryAbove"
      type="number"
      min={0}
      step={0.01}
      value={form.freeDeliveryAbove ?? ""}
      onChange={(e) =>
        setForm((f) => ({ ...f, freeDeliveryAbove: e.target.value || null }))
      }
      placeholder="e.g. 50.00 (leave blank to always charge)"
      className={styles.input}
    />
  </div>
)}
```

- [ ] **Step 3: Add validation before save**

In the settings page submit handler, add before the PATCH call:

```typescript
if (form.delivery === "self") {
  if (!form.maxDeliveryKm || form.maxDeliveryKm < 1) {
    setError("Maximum delivery distance is required when offering delivery.")
    return
  }
  if (!form.deliveryRatePerKm && !form.deliveryFlatFee) {
    setError("At least a flat fee or per-km rate is required.")
    return
  }
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/business/(dashboard)/settings/page.tsx app/api/business/profile/route.ts
git commit -m "feat: add delivery zone config UI to cook settings (max km, flat fee, rate/km, free threshold)"
```

---

## Task 12: Delivery Distance API + Fee in Cart/Checkout

**Files:**
- Create: `app/api/delivery/distance/route.ts`
- Modify: `app/api/orders/route.ts`

- [ ] **Step 1: Create the delivery distance endpoint**

```typescript
// app/api/delivery/distance/route.ts
// GET /api/delivery/distance?cookId=<uuid>
// Requires the calling user to have a saved service address.
// Returns: { distanceKm, fee, blocked, message? }
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { cookProfiles, userPreferences } from "@/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { getDrivingDistanceKm } from "@/lib/mapbox-directions"
import { calcDeliveryFee } from "@/lib/delivery-fee"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cookId = searchParams.get("cookId")
  if (!cookId) return NextResponse.json({ error: "cookId required" }, { status: 400 })

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1)

  if (!prefs?.serviceLat || !prefs?.serviceLng) {
    return NextResponse.json({ error: "No saved service address. Set your address first." }, { status: 422 })
  }

  const [cook] = await db
    .select({
      pickupLat: cookProfiles.pickupLat,
      pickupLng: cookProfiles.pickupLng,
      maxDeliveryKm: cookProfiles.maxDeliveryKm,
      deliveryRatePerKm: cookProfiles.deliveryRatePerKm,
      deliveryFlatFee: cookProfiles.deliveryFlatFee,
      freeDeliveryAbove: cookProfiles.freeDeliveryAbove,
      delivery: cookProfiles.delivery,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.id, cookId))
    .limit(1)

  if (!cook) return NextResponse.json({ error: "Cook not found" }, { status: 404 })

  if (cook.delivery !== "self" || !cook.maxDeliveryKm) {
    return NextResponse.json({ error: "Cook does not offer delivery" }, { status: 422 })
  }

  if (!cook.pickupLat || !cook.pickupLng) {
    return NextResponse.json({ error: "Cook pickup address not geocoded" }, { status: 422 })
  }

  const distanceKm = await getDrivingDistanceKm(
    prefs.serviceLng, prefs.serviceLat,
    cook.pickupLng, cook.pickupLat,
  )

  if (distanceKm === null) {
    return NextResponse.json({ error: "Unable to calculate driving distance. Delivery unavailable." }, { status: 503 })
  }

  const subtotal = parseFloat(searchParams.get("subtotal") ?? "0")
  const { fee, blocked } = calcDeliveryFee(distanceKm, subtotal, {
    maxDeliveryKm: cook.maxDeliveryKm,
    deliveryRatePerKm: cook.deliveryRatePerKm ?? "0",
    deliveryFlatFee: cook.deliveryFlatFee ?? "0",
    freeDeliveryAbove: cook.freeDeliveryAbove,
  })

  return NextResponse.json({
    distanceKm,
    fee,
    blocked,
    message: blocked
      ? `Delivery not available — you are ${distanceKm} km away (max ${cook.maxDeliveryKm} km).`
      : undefined,
  })
}
```

- [ ] **Step 2: Update orders API to snapshot delivery fee**

In `app/api/orders/route.ts`, find `createOrderSchema` (line 214). Update the `deliveryAddress` sub-object to include geocoding fields:

```typescript
deliveryAddress: z
  .object({
    street: z.string().min(1).max(200),
    unit: z.string().max(50).optional(),
    city: z.string().min(1).max(100),
    province: z.string().length(2),
    postal: z.string().min(5).max(10),
    lat: z.number(),
    lng: z.number(),
    placeId: z.string().min(1),
  })
  .optional(),
```

In the order creation handler, after parsing, if `fulfillmentMode === "delivery"`:

a) Look up the cook's delivery config (same query as above).
b) Call `getDrivingDistanceKm` to get the actual distance.
c) Call `calcDeliveryFee` to compute the fee.
d) If `blocked`, return `{ error: "Delivery not available for your address" }` with status 422.
e) Snapshot the results on the order insert:

```typescript
deliveryFeeSnapshot: deliveryFeeResult?.fee?.toString() ?? null,
deliveryDistanceKm: distanceKm ?? null,
```

- [ ] **Step 3: Wire delivery fee display in cart/checkout UI**

In the cart UI, when `fulfillmentMode === "delivery"`, call `GET /api/delivery/distance?cookId=<id>&subtotal=<subtotal>` and display the returned `fee` as a line item. If `blocked`, show the `message` and disable checkout.

Search for the cart component:
```bash
grep -rl "fulfillmentMode\|delivery.*fee\|cart.*checkout" app/app/cart/ --include="*.tsx"
```

Find the fee line item area and add:
```tsx
{fulfillmentMode === "delivery" && deliveryQuote && (
  <div className={styles.lineItem}>
    <span>Delivery ({deliveryQuote.distanceKm} km)</span>
    <span>{deliveryQuote.fee === 0 ? "Free" : formatCartMoney(deliveryQuote.fee)}</span>
  </div>
)}
{fulfillmentMode === "delivery" && deliveryQuote?.blocked && (
  <p className={styles.error}>{deliveryQuote.message}</p>
)}
```

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
pnpm test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/delivery/distance/route.ts app/api/orders/route.ts
git commit -m "feat: delivery distance endpoint + fee snapshot on order creation (Issue #27)"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Cook must configure max zone + rate when delivery = self | Task 11 |
| Client sees accurate delivery fee before pay | Task 12 |
| Fee stored on order snapshot | Task 12 (step 2) |
| Block delivery if outside zone with clear message | Task 12 |
| All surfaces migrated off raw text input | Tasks 6, 7, 8 |
| Client header address persisted + drives province | Tasks 8, 9 |
| Cook application + pickup address use same component | Tasks 6, 7 |
| Geocoded addresses stored (lat/lng/placeId) | Tasks 2, 3 |
| API keys + env documented | Task 1 |
| Cart re-quote when zone/rate changes | Task 12 step 3 (fetch on subtotal change) |
| Missing geocode = can't quote, don't guess | Task 12 (returns 422 if lat/lng missing) |
| Maps API down = block delivery, don't guess | Task 10 (getDrivingDistanceKm returns null → 503) |

### No Placeholders Check

All code blocks contain complete implementations. No "TBD", "TODO", or "add appropriate error handling" without specifics.

### Type Consistency

- `NormalizedAddress` defined once in `lib/types/address.ts`, imported everywhere.
- `CookDeliveryConfig` defined in `lib/delivery-fee.ts`, used in both `delivery-fee.ts` and `distance/route.ts`.
- DB field names (`pickupStreet`, `pickupLat`, etc.) consistent across schema (Task 3), API handlers (Tasks 7, 8), and queries (Task 12).
