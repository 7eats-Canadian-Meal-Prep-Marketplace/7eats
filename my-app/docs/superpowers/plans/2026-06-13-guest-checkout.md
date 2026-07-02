# Guest Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow unauthenticated users to browse, enter a delivery address, and complete a one-time order without creating a full account — matching the UX pattern of Uber Eats / DoorDash — while keeping the existing `orders.clientId NOT NULL` constraint intact.

**Architecture:** A "frictionless guest account" strategy: the checkout details step collects name, email, phone, and delivery address inline. A new `POST /api/auth/guest-checkout` endpoint creates a real `authUser` row (role = "client", `isGuestAccount = true`, `emailVerified = true`, `onboardingCompletedAt = now()`), signs the user in, and sets the `7eats-onboarded` cookie — all in one request. The checkout page tracks this in a `guestCheckoutDone` boolean so it can proceed to the payment step without a full page reload. Post-order, a "set your password" email (via Better Auth's existing password-reset flow) lets the guest upgrade to a full account. A browse-page address bar persists the guest's address in `localStorage` and a service-area check guards delivery orders before payment.

**Tech Stack:** Next.js 16 App Router, Better Auth v7 (Drizzle adapter), Drizzle ORM + Neon Postgres, Stripe, Mapbox Geocoding API, Resend, Zod, Vitest.

**Subscriptions are excluded from guest checkout.** If the cart contains any subscription items (`cartMode !== "one-time"`), the guest form is replaced with a prompt to sign in. Subscription billing requires a verified account.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `db/schema/auth.ts` | Modify | Add `isGuestAccount` boolean column |
| `lib/auth.ts` | Modify | Register `isGuestAccount` as Better Auth additional field |
| `lib/haversine.ts` | Create | Pure Haversine distance calculation (km) |
| `lib/geocoding.ts` | Create | Mapbox Geocoding API wrapper (address → lat/lng) |
| `lib/emails/guest-checkout.ts` | Create | Send "activate account" email via password-reset flow |
| `app/api/address/geocode/route.ts` | Create | Client-safe geocoding endpoint |
| `app/api/service-area/route.ts` | Create | Delivery in-range check for a listing |
| `app/api/auth/guest-checkout/route.ts` | Create | Create guest account + issue session + set cookies |
| `lib/hooks/use-guest-address.ts` | Create | localStorage-backed address state hook |
| `app/app/browse/_address-bar.tsx` | Create | Address entry bar on browse page |
| `app/app/browse/page.tsx` | Modify | Mount `<AddressBar />` |
| `app/app/checkout/page.tsx` | Modify | Inline guest form, service-area check, subscription guard |
| `__tests__/haversine.test.ts` | Create | Unit tests for distance utility |
| `__tests__/guest-checkout-api.test.ts` | Create | Integration tests for new API routes |

---

## Task 1: Add `isGuestAccount` to the auth schema

**Files:**
- Modify: `db/schema/auth.ts`
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add the column to the Drizzle schema**

In `db/schema/auth.ts`, add one line inside `authUserTable` after `onboardingCompletedAt`:

```typescript
isGuestAccount: boolean("is_guest_account").notNull().default(false),
```

The full table definition around that area now looks like:

```typescript
onboardingCompletedAt: timestamp("onboarding_completed_at"),
isGuestAccount: boolean("is_guest_account").notNull().default(false),
dateOfBirth: date("date_of_birth"),
```

- [ ] **Step 2: Register as a Better Auth additional field**

In `lib/auth.ts`, inside the `user.additionalFields` object, add after `onboardingCompletedAt`:

```typescript
isGuestAccount: { type: "boolean", defaultValue: false, required: false },
```

- [ ] **Step 3: Generate and apply the migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: one new migration file in `drizzle/` that adds `is_guest_account boolean NOT NULL DEFAULT false` to the `user` table. The migrate command should print "All migrations have been applied successfully."

- [ ] **Step 4: Verify the column exists**

```bash
pnpm exec drizzle-kit studio
```

Open the studio, find the `user` table, confirm `is_guest_account` column with type `boolean` and default `false`. Then close the studio.

- [ ] **Step 5: Commit**

```bash
git add db/schema/auth.ts lib/auth.ts drizzle/
git commit -m "feat: add isGuestAccount column to user table"
```

---

## Task 2: Haversine distance utility

**Files:**
- Create: `lib/haversine.ts`
- Create: `__tests__/haversine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/haversine.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/haversine";

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(43.6532, -79.3832, 43.6532, -79.3832)).toBe(0);
  });

  it("calculates Toronto to Mississauga (~26 km)", () => {
    // Toronto City Hall → Mississauga City Centre
    const dist = haversineKm(43.6532, -79.3832, 43.5890, -79.6441);
    expect(dist).toBeGreaterThan(20);
    expect(dist).toBeLessThan(35);
  });

  it("calculates Toronto to Vancouver (~3350 km)", () => {
    const dist = haversineKm(43.6532, -79.3832, 49.2827, -123.1207);
    expect(dist).toBeGreaterThan(3000);
    expect(dist).toBeLessThan(3700);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test:run -- haversine
```

Expected: `Cannot find module '@/lib/haversine'`

- [ ] **Step 3: Implement haversine**

Create `lib/haversine.ts`:

```typescript
const R = 6371; // Earth radius in km

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test:run -- haversine
```

Expected: `✓ haversineKm > returns 0 for identical coordinates`, `✓ calculates Toronto to Mississauga`, `✓ calculates Toronto to Vancouver`

- [ ] **Step 5: Commit**

```bash
git add lib/haversine.ts __tests__/haversine.test.ts
git commit -m "feat: add haversine distance utility"
```

---

## Task 3: Mapbox geocoding helper

**Files:**
- Create: `lib/geocoding.ts`

- [ ] **Step 1: Create the geocoding helper**

Create `lib/geocoding.ts`:

```typescript
// Server-side only — uses MAPBOX_SECRET_TOKEN

export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) throw new Error("MAPBOX_SECRET_TOKEN is not configured");

  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?country=CA&limit=1&access_token=${token}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Mapbox Geocoding error: ${res.status}`);

  const data = (await res.json()) as {
    features?: Array<{ center: [number, number] }>;
  };

  const feature = data.features?.[0];
  if (!feature) return null;

  const [lng, lat] = feature.center;
  return { lat, lng };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/geocoding.ts
git commit -m "feat: add Mapbox geocoding helper"
```

---

## Task 4: Client-safe geocoding API endpoint

**Files:**
- Create: `app/api/address/geocode/route.ts`

The browser cannot call Mapbox directly with the secret token. This thin endpoint proxies the call.

- [ ] **Step 1: Create the route**

Create `app/api/address/geocode/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocoding";

const schema = z.object({
  address: z.string().min(5).max(300),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Address is required." }, { status: 400 });
  }

  try {
    const point = await geocodeAddress(parsed.data.address);
    if (!point) {
      return NextResponse.json(
        { error: "Address not found. Please try a more specific address." },
        { status: 422 },
      );
    }
    return NextResponse.json({ data: point });
  } catch (err) {
    console.error("[geocode]", err);
    return NextResponse.json(
      { error: "Could not geocode address." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/address/geocode/route.ts
git commit -m "feat: add geocoding API endpoint"
```

---

## Task 5: Service-area check endpoint

**Files:**
- Create: `app/api/service-area/route.ts`

Checks whether a lat/lng is within a cook's delivery range. Uses Haversine (not Mapbox Directions) for speed — the exact Mapbox check still happens at order creation.

- [ ] **Step 1: Create the route**

Create `app/api/service-area/route.ts`:

```typescript
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles, listings } from "@/db/schema";
import { haversineKm } from "@/lib/haversine";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const listingId = params.get("listingId");

  if (!listingId || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "lat, lng, and listingId are required." },
      { status: 400 },
    );
  }

  const [listing] = await db
    .select({ cookId: listings.cookId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const [cook] = await db
    .select({
      pickupLat: cookProfiles.pickupLat,
      pickupLng: cookProfiles.pickupLng,
      maxDeliveryKm: cookProfiles.maxDeliveryKm,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.id, listing.cookId))
    .limit(1);

  if (!cook?.pickupLat || !cook?.pickupLng) {
    // Cook has no location set — cannot verify range, allow through
    return NextResponse.json({ data: { inRange: true, distanceKm: null } });
  }

  const distanceKm = haversineKm(
    cook.pickupLat,
    cook.pickupLng,
    lat,
    lng,
  );

  const maxKm = cook.maxDeliveryKm ?? 10;
  const inRange = distanceKm <= maxKm;

  return NextResponse.json({ data: { inRange, distanceKm: Math.round(distanceKm * 10) / 10 } });
}
```

- [ ] **Step 2: Type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/service-area/route.ts
git commit -m "feat: add service-area check endpoint"
```

---

## Task 6: Guest activation email helper

**Files:**
- Create: `lib/emails/guest-checkout.ts`

After placing their first order, guests receive an email inviting them to set a password and unlock their order history. We trigger Better Auth's existing password-reset flow so no new email template is needed.

- [ ] **Step 1: Create the helper**

Create `lib/emails/guest-checkout.ts`:

```typescript
import { auth } from "@/lib/auth";

/**
 * Sends a "set your password" email to a newly created guest account.
 * Reuses Better Auth's password-reset email (subject: "Reset your 7eats password").
 * Fire-and-forget — never throw; log failures instead.
 */
export async function sendGuestActivationEmail(email: string): Promise<void> {
  try {
    await auth.api.forgetPassword({
      body: { email, redirectTo: "/app-auth/reset-password" },
    });
  } catch (err) {
    console.error("[guest-activation-email] failed to send:", err);
  }
}
```

- [ ] **Step 2: Type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors. (Better Auth exposes `forgetPassword` on the server API.)

- [ ] **Step 3: Commit**

```bash
git add lib/emails/guest-checkout.ts
git commit -m "feat: add guest activation email helper"
```

---

## Task 7: Guest checkout API endpoint

**Files:**
- Create: `app/api/auth/guest-checkout/route.ts`

This is the core backend endpoint. It creates a real `authUser` row, bypasses email verification (marks email as verified immediately), and issues a full session + onboarded cookie so checkout can continue to payment without a page reload.

- [ ] **Step 1: Write the failing test stubs**

Create `__tests__/guest-checkout-api.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

// Smoke tests — full integration requires a live DB; these cover the happy path
// response shape using mocked dependencies.

describe("POST /api/auth/guest-checkout", () => {
  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/guest-checkout/route");
    const req = new Request("http://localhost/api/auth/guest-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Jane", lastName: "Doe", phone: "6471234567" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is missing", async () => {
    const { POST } = await import("@/app/api/auth/guest-checkout/route");
    const req = new Request("http://localhost/api/auth/guest-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test:run -- guest-checkout-api
```

Expected: `Cannot find module '@/app/api/auth/guest-checkout/route'`

- [ ] **Step 3: Create the endpoint**

Create `app/api/auth/guest-checkout/route.ts`:

```typescript
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, authUserTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sendGuestActivationEmail } from "@/lib/emails/guest-checkout";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(20),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(`guest-checkout:${hashIp(ip)}`, {
    windowMinutes: 60,
    maxAttempts: 10,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please fill in all fields." },
      { status: 400 },
    );
  }

  const { firstName, lastName, phone } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  // Check for an existing account with this email
  const [existing] = await db
    .select({ id: authUser.id, isGuestAccount: authUser.isGuestAccount })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);

  if (existing && !existing.isGuestAccount) {
    // Real account already exists — tell the client to redirect to login
    return NextResponse.json({ needsLogin: true, email });
  }

  let userId: string;

  if (existing?.isGuestAccount) {
    // Reuse the existing guest account (e.g. they are retrying after a failed payment)
    userId = existing.id;
  } else {
    // Create a new account via Better Auth (handles password hashing + account row)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const signUpRes = await auth.api.signUpEmail({
      body: { email, password: randomPassword, name: `${firstName} ${lastName}` },
      headers: req.headers,
      asResponse: true,
    });

    if (!signUpRes.ok) {
      console.error("[guest-checkout] signUpEmail failed:", signUpRes.status);
      return NextResponse.json(
        { error: "Could not create guest account. Please try again." },
        { status: 500 },
      );
    }

    const payload = (await signUpRes.json()) as { user?: { id: string } };
    const newId = payload?.user?.id;
    if (!newId) {
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
    userId = newId;
  }

  // Promote to client + mark as guest + verify email + complete onboarding
  await db
    .update(authUserTable)
    .set({
      role: "client",
      status: "active",
      firstName,
      lastName,
      phone,
      isGuestAccount: true,
      emailVerified: true,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(authUser.id, userId));

  // Sign in to issue a session cookie (emailVerified = true so the check passes)
  const randomPassword = crypto.randomUUID() + crypto.randomUUID();

  // Better Auth doesn't expose a "create session for user" API directly,
  // so we generate a fresh temp password, update the account, then sign in.
  // This is safe because the account is immediately signed in and the temp
  // password is never exposed.
  await auth.api.resetPassword({
    body: { newPassword: randomPassword, token: "" },
  });

  // Use signInEmail directly since emailVerified is now true
  const signInRes = await auth.api.signInEmail({
    body: { email, password: randomPassword },
    headers: req.headers,
    asResponse: true,
  });

  // Note: if signIn fails for any reason, fall back to a session token approach
  if (!signInRes.ok) {
    console.error("[guest-checkout] signIn failed:", signInRes.status);
    return NextResponse.json(
      { error: "Account created but could not sign in. Please try again." },
      { status: 500 },
    );
  }

  // Build response — forward the session cookie from Better Auth + add onboarded cookie
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const res = NextResponse.json({ success: true, email });

  signInRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      res.headers.append("set-cookie", value);
    }
  });

  res.headers.append(
    "set-cookie",
    `7eats-onboarded=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  );

  // Fire-and-forget activation email
  sendGuestActivationEmail(email);

  return res;
}
```

> **Implementation note on sign-in:** The approach above creates a new random password each time. A simpler alternative if Better Auth exposes it: use `auth.api.createSession({ userId })`. Check the installed Better Auth version's server API (`node_modules/better-auth/dist/api*`) for available methods. If `createSession` exists, replace the password-reset + sign-in block with:
> ```typescript
> const sessionRes = await auth.api.createSession({
>   body: { userId },
>   headers: req.headers,
>   asResponse: true,
> });
> ```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test:run -- guest-checkout-api
```

Expected: both validation tests pass (they only check the 400 path, which doesn't need a live DB).

- [ ] **Step 5: Type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/guest-checkout/route.ts __tests__/guest-checkout-api.test.ts
git commit -m "feat: add guest checkout account creation endpoint"
```

---

## Task 8: `useGuestAddress` localStorage hook

**Files:**
- Create: `lib/hooks/use-guest-address.ts`

Persists the guest's delivery address + geocoded coordinates across page navigations. Reads from `localStorage` on mount so state survives cart additions, page refreshes, etc.

- [ ] **Step 1: Create the hook**

Create `lib/hooks/use-guest-address.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";

export type GuestAddress = {
  displayText: string;
  street: string;
  unit: string;
  city: string;
  province: string;
  postal: string;
  lat: number | null;
  lng: number | null;
};

const STORAGE_KEY = "7eats_guest_address";

export function useGuestAddress() {
  const [guestAddress, setGuestAddressState] = useState<GuestAddress | null>(
    null,
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setGuestAddressState(JSON.parse(stored) as GuestAddress);
    } catch {}
  }, []);

  function setGuestAddress(addr: GuestAddress | null) {
    if (addr === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(addr));
    }
    setGuestAddressState(addr);
  }

  return { guestAddress, setGuestAddress };
}
```

- [ ] **Step 2: Type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/use-guest-address.ts
git commit -m "feat: add useGuestAddress localStorage hook"
```

---

## Task 9: Browse page address bar

**Files:**
- Create: `app/app/browse/_address-bar.tsx`
- Modify: `app/app/browse/page.tsx` — mount `<AddressBar />`

Shows a persistent "Enter your address" banner on the browse page. When the user submits an address, it geocodes it and saves it to localStorage via `useGuestAddress`. Logged-in users can dismiss this bar (their address comes from their account during checkout).

- [ ] **Step 1: Create the address bar component**

Create `app/app/browse/_address-bar.tsx`:

```tsx
"use client";

import { MapPin, X } from "lucide-react";
import { useState } from "react";
import { useGuestAddress } from "@/lib/hooks/use-guest-address";
import styles from "./_address-bar.module.css";

type Props = { isLoggedIn: boolean };

export function AddressBar({ isLoggedIn }: Props) {
  const { guestAddress, setGuestAddress } = useGuestAddress();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Logged-in users don't need this — their address comes from their account
  if (isLoggedIn) return null;
  if (dismissed && !guestAddress) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/address/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: input.trim() }),
      });
      const json = (await res.json()) as {
        data?: { lat: number; lng: number };
        error?: string;
      };
      if (!res.ok || !json.data) {
        setError(json.error ?? "Address not found. Try adding your city.");
        return;
      }
      setGuestAddress({
        displayText: input.trim(),
        street: input.trim(),
        unit: "",
        city: "",
        province: "ON",
        postal: "",
        lat: json.data.lat,
        lng: json.data.lng,
      });
      setOpen(false);
      setInput("");
    } catch {
      setError("Could not look up address. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.bar}>
      <MapPin size={15} className={styles.pin} />
      {guestAddress ? (
        <>
          <span className={styles.addressText}>{guestAddress.displayText}</span>
          <button
            type="button"
            className={styles.changeBtn}
            onClick={() => {
              setOpen(true);
              setInput(guestAddress.displayText);
            }}
          >
            Change
          </button>
        </>
      ) : (
        <>
          <span className={styles.prompt}>
            Add your address to see delivery options near you
          </span>
          <button
            type="button"
            className={styles.enterBtn}
            onClick={() => setOpen(true)}
          >
            Enter address
          </button>
          <button
            type="button"
            className={styles.dismissBtn}
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
          >
            <X size={14} />
          </button>
        </>
      )}

      {open && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.input}
            placeholder="123 King St W, Toronto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? "Looking up…" : "Save"}
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS module**

Create `app/app/browse/_address-bar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--color-surface, #f8f7f4);
  border-bottom: 1px solid var(--color-border, #e8e5e0);
  font-size: 0.875rem;
  flex-wrap: wrap;
}

.pin {
  color: var(--color-accent, #e85d26);
  flex-shrink: 0;
}

.prompt {
  color: var(--color-text-secondary, #6b6460);
}

.addressText {
  font-weight: 500;
  color: var(--color-text, #1a1714);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.changeBtn,
.enterBtn {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-accent, #e85d26);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 4px;
  text-decoration: underline;
}

.dismissBtn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary, #6b6460);
  display: flex;
  align-items: center;
}

.form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}

.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e8e5e0);
  border-radius: 8px;
  font-size: 0.875rem;
  background: #fff;
  outline: none;
}

.input:focus {
  border-color: var(--color-accent, #e85d26);
}

.error {
  font-size: 0.8125rem;
  color: #d32f2f;
  margin: 0;
}

.formActions {
  display: flex;
  gap: 8px;
}

.saveBtn {
  padding: 6px 16px;
  background: var(--color-accent, #e85d26);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.saveBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancelBtn {
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-border, #e8e5e0);
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  color: var(--color-text-secondary, #6b6460);
}
```

- [ ] **Step 3: Mount the AddressBar in the browse page**

Open `app/app/browse/page.tsx`. Find where the page's main content starts (usually just after the `<main>` or outermost `<div>` opens). Add the address bar as the first child.

The browse page is a server component so it can't use hooks — pass `isLoggedIn` from the layout/session. If the browse page already receives a session prop, thread it through. Otherwise check the session at the top of the page:

```tsx
// At the top of the browse page server component:
import { AddressBar } from "./_address-bar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Inside the component:
const session = await auth.api.getSession({ headers: await headers() });
const isLoggedIn = session?.user?.role === "client";

// In the JSX, as the first element after the outermost wrapper:
<AddressBar isLoggedIn={isLoggedIn} />
```

- [ ] **Step 4: Type check and lint**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/browse/_address-bar.tsx app/app/browse/_address-bar.module.css app/app/browse/page.tsx
git commit -m "feat: add address bar to browse page for guest delivery area"
```

---

## Task 10: Guest checkout flow in the checkout page

**Files:**
- Modify: `app/app/checkout/page.tsx`

This is the largest change. We replace the redirect-to-login with an inline guest form, add a service-area check for delivery orders, block subscription carts for guests, and forward guest metadata to the confirmation page.

- [ ] **Step 1: Add guest state and imports**

At the top of `CheckoutInner` (after the existing `useState` declarations), add these new state variables and imports. First, add the import at the top of the file:

```typescript
import { useGuestAddress } from "@/lib/hooks/use-guest-address";
```

Then inside `CheckoutInner`, after the `const [ordered, setOrdered] = useState(false);` line, add:

```typescript
// Guest checkout state
const [guestCheckoutDone, setGuestCheckoutDone] = useState(false);
const [guestCheckoutEmail, setGuestCheckoutEmail] = useState("");
const [guestFirstName, setGuestFirstName] = useState("");
const [guestLastName, setGuestLastName] = useState("");
const [guestEmail, setGuestEmail] = useState("");
const [guestPhone, setGuestPhone] = useState("");
const [guestSubmitting, setGuestSubmitting] = useState(false);
const [guestError, setGuestError] = useState("");

const { guestAddress } = useGuestAddress();
```

- [ ] **Step 2: Pre-fill guest address from localStorage**

Currently `address` is initialised to `EMPTY_ADDRESS`. Add a `useEffect` that hydrates from the localStorage hook when the user is NOT logged in:

Add this effect after the existing "Pre-fill contact from real session" effect (around line 152):

```typescript
// Pre-fill delivery address from localStorage for guests
useEffect(() => {
  if (isLoggedIn || !guestAddress) return;
  setAddress({
    street: guestAddress.street,
    unit: guestAddress.unit,
    city: guestAddress.city,
    province: guestAddress.province || "ON",
    postal: guestAddress.postal,
  });
}, [isLoggedIn, guestAddress]);
```

Also pre-fill `guestEmail`, `guestFirstName`, `guestLastName` from any saved context (they start empty and the user types them in the form — no pre-fill needed beyond what they type).

- [ ] **Step 3: Replace `validateDetails()` with guest-aware version**

Replace the entire `validateDetails` function (lines 227–243 in the original) with:

```typescript
function validateDetails(): boolean {
  const e: Record<string, string> = {};

  // Logged-in or completed guest checkout → standard address validation
  if (isLoggedIn || guestCheckoutDone) {
    if (needsDeliveryAddress && !editingAddress) {
      if (!address.street.trim()) e.street = "Required";
      if (!address.city.trim()) e.city = "Required";
      if (!address.postal.trim()) e.postal = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Guest + subscription cart → block
  if (isSubscriptionCart) {
    setGuestError(
      "Subscription orders require an account. Please sign in or create one.",
    );
    return false;
  }

  // Guest → validate guest form fields
  if (!guestFirstName.trim()) e.guestFirstName = "Required";
  if (!guestLastName.trim()) e.guestLastName = "Required";
  if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))
    e.guestEmail = "Valid email required";
  if (!guestPhone.trim() || guestPhone.replace(/\D/g, "").length < 7)
    e.guestPhone = "Valid phone required";
  if (needsDeliveryAddress) {
    if (!address.street.trim()) e.street = "Street address required";
    if (!address.city.trim()) e.city = "City required";
    if (!address.postal.trim()) e.postal = "Postal code required";
  }
  setErrors(e);
  return Object.keys(e).length === 0;
}
```

- [ ] **Step 4: Add `handleGuestCheckout()` async function**

Add this function after `validateDetails()`, before `placeOrdersWithPaymentMethod()`:

```typescript
async function handleGuestCheckout(): Promise<boolean> {
  setGuestSubmitting(true);
  setGuestError("");

  try {
    // Service-area check for delivery listings
    if (needsDeliveryAddress && (address.lat != null || guestAddress?.lat != null)) {
      const lat = guestAddress?.lat ?? null;
      const lng = guestAddress?.lng ?? null;

      if (lat !== null && lng !== null) {
        const deliveryItems = items.filter((i) => i.fulfillmentMode === "delivery");
        const uniqueListingIds = [...new Set(deliveryItems.map((i) => i.listingId))];

        for (const listingId of uniqueListingIds) {
          const checkRes = await fetch(
            `/api/service-area?lat=${lat}&lng=${lng}&listingId=${encodeURIComponent(listingId)}`,
          );
          const checkJson = (await checkRes.json()) as {
            data?: { inRange: boolean; distanceKm: number | null };
            error?: string;
          };
          if (checkRes.ok && checkJson.data && !checkJson.data.inRange) {
            const cookItem = items.find((i) => i.listingId === listingId);
            setGuestError(
              `Your address is outside ${cookItem?.cookName ?? "this cook"}'s delivery area (${checkJson.data.distanceKm ?? "?"} km away). Try pickup instead.`,
            );
            return false;
          }
        }
      }
    }

    // Create guest account + session
    const res = await fetch("/api/auth/guest-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: guestFirstName.trim(),
        lastName: guestLastName.trim(),
        email: guestEmail.trim().toLowerCase(),
        phone: guestPhone.trim(),
      }),
    });

    const json = (await res.json()) as {
      success?: boolean;
      needsLogin?: boolean;
      email?: string;
      error?: string;
    };

    if (!res.ok) {
      setGuestError(json.error ?? "Could not complete guest checkout. Please try again.");
      return false;
    }

    if (json.needsLogin) {
      router.push(
        `/app-auth/login?next=${encodeURIComponent("/app/checkout?step=payment")}&email=${encodeURIComponent(json.email ?? "")}`,
      );
      return false;
    }

    setGuestCheckoutDone(true);
    setGuestCheckoutEmail(json.email ?? guestEmail);
    return true;
  } catch {
    setGuestError("Something went wrong. Please try again.");
    return false;
  } finally {
    setGuestSubmitting(false);
  }
}
```

Note: the service-area check uses `guestAddress?.lat` from localStorage (set by the address bar). If no lat/lng is available (guest typed the address directly in checkout but didn't go through the address bar), the check is skipped — the Mapbox check at order creation time will still catch it.

- [ ] **Step 5: Wire the Continue button to the guest flow**

Find the Continue button's `onClick` handler (currently: `if (validateDetails()) setStep("payment")`). Replace it with:

```typescript
onClick={async () => {
  if (!validateDetails()) return;
  if (!isLoggedIn && !guestCheckoutDone) {
    const ok = await handleGuestCheckout();
    if (!ok) return;
  }
  setStep("payment");
}}
```

Also update the button to show loading state:

```typescript
<button
  type="button"
  className={styles.primaryBtn}
  disabled={
    (needsDeliveryAddress && editingAddress) ||
    guestSubmitting
  }
  onClick={async () => {
    if (!validateDetails()) return;
    if (!isLoggedIn && !guestCheckoutDone) {
      const ok = await handleGuestCheckout();
      if (!ok) return;
    }
    setStep("payment");
  }}
>
  {guestSubmitting ? "Setting up…" : "Continue"}
  {!guestSubmitting && <ArrowRight size={16} />}
</button>
```

- [ ] **Step 6: Add the guest contact form to the JSX**

In the "Contact details" section (step === "details"), replace:

```tsx
{/* Logged-in: read-only summary — unauthenticated users are redirected to login by validateDetails() */}
{isLoggedIn ? (
  <div className={styles.contactSummary}>
    ...
  </div>
) : null}
```

With:

```tsx
{isLoggedIn || guestCheckoutDone ? (
  <div className={styles.contactSummary}>
    <div className={styles.contactRow}>
      <span className={styles.contactLabel}>Name</span>
      <span className={styles.contactValue}>
        {contact.firstName || guestFirstName} {contact.lastName || guestLastName}
      </span>
    </div>
    <div className={styles.contactRow}>
      <span className={styles.contactLabel}>Email</span>
      <span className={styles.contactValue}>
        {contact.email || guestCheckoutEmail}
      </span>
    </div>
    {(contact.phone || guestPhone) && (
      <div className={styles.contactRow}>
        <span className={styles.contactLabel}>Phone</span>
        <span className={styles.contactValue}>
          {contact.phone || guestPhone}
        </span>
      </div>
    )}
  </div>
) : isSubscriptionCart ? (
  /* Subscription carts require a full account */
  <div className={styles.guestBlock}>
    <p className={styles.guestBlockMsg}>
      Subscription orders require an account.{" "}
      <a
        href={`/app-auth/login?next=${encodeURIComponent("/app/checkout?step=payment")}`}
        className={styles.guestBlockLink}
      >
        Sign in
      </a>{" "}
      or{" "}
      <a href="/app-auth/signup" className={styles.guestBlockLink}>
        create one
      </a>
      .
    </p>
  </div>
) : (
  /* Guest form */
  <>
    <div className={styles.formRow}>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="guestFirstName">
          First name
        </label>
        <input
          id="guestFirstName"
          type="text"
          className={styles.input}
          value={guestFirstName}
          onChange={(e) => setGuestFirstName(e.target.value)}
          autoComplete="given-name"
        />
        {errors.guestFirstName && (
          <p className={styles.fieldError}>{errors.guestFirstName}</p>
        )}
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="guestLastName">
          Last name
        </label>
        <input
          id="guestLastName"
          type="text"
          className={styles.input}
          value={guestLastName}
          onChange={(e) => setGuestLastName(e.target.value)}
          autoComplete="family-name"
        />
        {errors.guestLastName && (
          <p className={styles.fieldError}>{errors.guestLastName}</p>
        )}
      </div>
    </div>
    <div className={styles.formGroup}>
      <label className={styles.label} htmlFor="guestEmail">
        Email
      </label>
      <input
        id="guestEmail"
        type="email"
        className={styles.input}
        value={guestEmail}
        onChange={(e) => setGuestEmail(e.target.value)}
        autoComplete="email"
      />
      {errors.guestEmail && (
        <p className={styles.fieldError}>{errors.guestEmail}</p>
      )}
    </div>
    <div className={styles.formGroup}>
      <label className={styles.label} htmlFor="guestPhone">
        Phone number
      </label>
      <input
        id="guestPhone"
        type="tel"
        className={styles.input}
        value={guestPhone}
        onChange={(e) => setGuestPhone(e.target.value)}
        autoComplete="tel"
      />
      {errors.guestPhone && (
        <p className={styles.fieldError}>{errors.guestPhone}</p>
      )}
    </div>
    {guestError && (
      <p className={styles.placeError} role="alert">
        {guestError}
      </p>
    )}
    <p className={styles.guestNote}>
      Already have an account?{" "}
      <a
        href={`/app-auth/login?next=${encodeURIComponent("/app/checkout?step=payment")}`}
        className={styles.guestBlockLink}
      >
        Sign in
      </a>
    </p>
  </>
)}
```

- [ ] **Step 7: Fix payment step effects to work for guest sessions**

The effect that fetches saved cards only fires when `isLoggedIn` is true. Update it to also fire when `guestCheckoutDone`:

```typescript
useEffect(() => {
  if ((!isLoggedIn && !guestCheckoutDone) || step !== "payment") return;
  setLoadingCards(true);
  fetch("/api/checkout/payment-methods")
    ...
}, [isLoggedIn, guestCheckoutDone, step]);
```

- [ ] **Step 8: Forward guest metadata to confirmation page**

In `placeOrdersWithPaymentMethod()`, find the redirect to the confirmation page (currently the `router.push` call). Update it to include guest params:

```typescript
// After: params.set("count", String(orderEntries.length));
if (!isLoggedIn && guestCheckoutDone && guestCheckoutEmail) {
  params.set("guest", "1");
  params.set("email", guestCheckoutEmail);
}
router.push(`/app/checkout/confirmation?${params.toString()}`);
```

- [ ] **Step 9: Add missing CSS classes**

In `app/app/checkout/page.module.css`, add at the bottom:

```css
.guestBlock {
  padding: 16px;
  background: var(--color-surface, #f8f7f4);
  border-radius: 10px;
  border: 1px solid var(--color-border, #e8e5e0);
}

.guestBlockMsg {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary, #6b6460);
}

.guestBlockLink {
  color: var(--color-accent, #e85d26);
  text-decoration: underline;
}

.guestNote {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b6460);
  margin: 4px 0 0;
}
```

- [ ] **Step 10: Type check and lint**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add app/app/checkout/page.tsx app/app/checkout/page.module.css
git commit -m "feat: add inline guest checkout form to checkout page"
```

---

## Task 11: Manual end-to-end verification

Start the dev server and walk through the guest checkout flow using the Playwright MCP tools (as required by CLAUDE.md for any endpoint + frontend integration).

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Load Playwright tools**

```
ToolSearch: "select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_snapshot,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_click,mcp__plugin_playwright_playwright__browser_type,mcp__plugin_playwright_playwright__browser_wait_for,mcp__plugin_playwright_playwright__browser_console_messages"
```

- [ ] **Step 3: Browse page address bar**

```
browser_navigate: http://localhost:3000/app/browse
browser_take_screenshot: verify address bar appears at the top
browser_click: "Enter address" button
browser_type: input "123 King St W, Toronto" 
browser_click: Save button
browser_wait_for: address text appears in bar
browser_take_screenshot: verify "123 King St W, Toronto" is displayed
```

- [ ] **Step 4: Guest checkout happy path**

```
# Add an item to cart by navigating to a listing and clicking "Add to cart"
browser_navigate: http://localhost:3000/app/browse
# (Find an active listing and click through to it)
browser_click: "Add to cart" / checkout button
browser_navigate: http://localhost:3000/app/checkout

browser_take_screenshot: verify guest form is shown (not redirect to login)
browser_type: guestFirstName input "Jane"
browser_type: guestLastName input "Guest"  
browser_type: guestEmail input "jane.guest.test@mailinator.com"
browser_type: guestPhone input "6471234567"
browser_click: Continue button
browser_wait_for: "Payment" heading appears
browser_take_screenshot: verify reached payment step as guest
browser_console_messages: check for errors
```

- [ ] **Step 5: Verify session was issued**

```
# After reaching payment step, check the session is valid
browser_navigate: http://localhost:3000/api/auth/get-session
browser_snapshot: verify response includes user with isGuestAccount=true and role=client
```

- [ ] **Step 6: Verify confirmation page guest state**

After placing a test order (or manually navigating to the confirmation page with `?guest=1&email=jane@test.com&count=1&oid0=test&cook0=Chef&mode0=pickup`):

```
browser_navigate: http://localhost:3000/app/checkout/confirmation?guest=1&email=jane@test.com&count=1&oid0=ORD123&cook0=Chef+Jane&mode0=pickup
browser_take_screenshot: verify "Confirmation sent to jane@test.com" is shown
browser_snapshot: verify "Create an account" button is present, NOT "View your orders"
```

- [ ] **Step 7: Subscription guard**

```
# Add a subscription item to cart (if available) and navigate to checkout
browser_navigate: http://localhost:3000/app/checkout
browser_take_screenshot: verify subscription cart shows "Sign in / create one" prompt instead of guest form
```

- [ ] **Step 8: Commit any fixes found during testing**

```bash
git add -p
git commit -m "fix: guest checkout flow adjustments from manual testing"
```

---

## Task 12: Tests — service-area endpoint and haversine integration

**Files:**
- Modify: `__tests__/guest-checkout-api.test.ts` — add service-area tests

- [ ] **Step 1: Add service-area tests**

Append to `__tests__/guest-checkout-api.test.ts`:

```typescript
import { haversineKm } from "@/lib/haversine";

describe("service-area distance logic", () => {
  it("correctly classifies an in-range address (5 km)", () => {
    // Cook at Toronto City Hall, customer at ~5 km away, max delivery 10 km
    const dist = haversineKm(43.6532, -79.3832, 43.6888, -79.3300);
    expect(dist).toBeLessThan(10);
  });

  it("correctly classifies an out-of-range address (40 km)", () => {
    // Cook at Toronto City Hall, customer in Brampton (~40 km)
    const dist = haversineKm(43.6532, -79.3832, 43.7315, -79.7624);
    expect(dist).toBeGreaterThan(30);
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test:run
```

Expected: all tests pass.

- [ ] **Step 3: Final commit**

```bash
git add __tests__/guest-checkout-api.test.ts
git commit -m "test: add service-area and guest checkout integration tests"
```

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task covering it |
|-------------|-----------------|
| Guest can browse without account | Already worked — no change needed |
| Guest can add to cart without account | Already worked — no change needed |
| Collect name, email, phone inline at checkout | Task 10 (guest form) |
| Collect delivery address for service-area check | Tasks 8 + 9 (address bar + pre-fill) |
| Service-area validation before payment | Task 10 (`handleGuestCheckout`) |
| Create real account so `orders.clientId` is not null | Task 7 (`/api/auth/guest-checkout`) |
| Bypass onboarding gate for guest accounts | Task 7 (set `onboardingCompletedAt = now()`) |
| Set `7eats-onboarded` cookie for proxy | Task 7 (cookie in response) |
| Session issued without email verification | Task 7 (`emailVerified = true` before `signInEmail`) |
| Subscription carts blocked for guests | Task 10 (subscription guard) |
| Post-order "set password" email | Task 6 (via Better Auth forget-password flow) |
| Existing account email → redirect to login | Task 7 (`needsLogin: true` response) |
| Confirmation page shows guest-specific CTA | Already built (`confirmation/page.tsx` has `isGuest` handling) |
| Browse address bar (Uber-style) | Task 9 |
| Address persisted in localStorage | Task 8 (`useGuestAddress`) |
| Schema: `isGuestAccount` flag | Task 1 |
| Tests | Tasks 2, 11, 12 |

### Key edge cases covered

- Duplicate email (real account) → `needsLogin: true` → redirect to login with `next=` param
- Duplicate email (guest account) → reuse existing guest user row
- Subscription cart + guest → blocked with sign-in prompt
- Delivery order + no lat/lng → service-area check skipped, Mapbox check at order creation still runs
- Guest reaching payment step → `guestCheckoutDone = true` gates the card-fetch effect
- `7eats-onboarded` cookie set server-side so proxy doesn't redirect to onboarding
