# Subscription Business Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription listing tiers, client subscriptions, Stripe recurring billing with manual-capture escrow, and subscription lifecycle management (subscribe, cancel, webhook-driven order creation).

**Architecture:** New `db/schema/subscriptions.ts` holds two tables (`listing_subscription_tiers`, `client_subscriptions`). Cook-side tier management lives under `/api/business/listings/[listingId]/tiers`. Client subscription management lives under `/api/subscriptions`. Stripe Products/Prices are created on the cook's connected account; Subscriptions use `capture_method: manual` so funds are held until pickup code is verified. A webhook handler creates one `orders` row (+ `order_payments` + `order_dishes` snapshot) per billing cycle, identical to one-time orders.

**Tech Stack:** Next.js App Router, Drizzle ORM, Neon PostgreSQL (RLS bypassed for server-side DATABASE_URL connections — application-layer auth via `getCookId`/session), Stripe v22 (`apiVersion: '2026-05-27.dahlia'`), Zod v4, Better Auth, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `db/schema/enums.ts` | Modify | Add `subscriptionInterval` and `subscriptionStatus` enums |
| `db/schema/subscriptions.ts` | Create | `listingSubscriptionTiers` + `clientSubscriptions` tables |
| `db/schema/index.ts` | Modify | Export new schema file |
| `db/schema/auth.ts` | Modify | Add `stripeCustomerId` to `authUser` |
| `db/schema/listings.ts` | Modify | Add `stripeProductId` to `listings` |
| `db/schema/orders.ts` | Modify | Add `subscriptionId` FK to `orders` |
| `lib/stripe-subscriptions.ts` | Create | All Stripe calls for subscription lifecycle |
| `lib/stripe-subscriptions.test.ts` | Create | Unit tests for interval mapping |
| `app/api/business/listings/[listingId]/tiers/route.ts` | Create | GET + POST tiers (cook-side) |
| `app/api/business/listings/[listingId]/tiers/[tierId]/route.ts` | Create | PATCH + DELETE tier (cook-side) |
| `app/api/subscriptions/_lib/client-auth.ts` | Create | Session helper for client routes |
| `app/api/subscriptions/route.ts` | Create | GET (list) + POST (subscribe) |
| `app/api/subscriptions/[subscriptionId]/route.ts` | Create | GET (detail) + DELETE (cancel) |
| `app/api/webhooks/stripe/route.ts` | Modify | Add invoice + subscription event handlers |
| `app/api/business/dashboard/orders/[orderId]/verify-code/route.ts` | Modify | Capture PaymentIntent on code verification |
| `app/api/business/listings/[listingId]/route.ts` | Modify | Include tiers in listing GET response |

---

## Task 1: Add new enums to `db/schema/enums.ts`

**Files:**
- Modify: `db/schema/enums.ts`

- [ ] **Step 1: Add the two new enums**

Open `db/schema/enums.ts` and append these two exports after the existing `lateCancelFeeTypeEnum`:

```typescript
export const subscriptionInterval = pgEnum("subscription_interval", [
  "weekly",
  "biweekly",
  "monthly",
]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "paused",
  "cancelled",
  "past_due",
]);
```

- [ ] **Step 2: Type-check**

```bash
pnpm build
```

Expected: no TypeScript errors related to the new enums.

- [ ] **Step 3: Commit**

```bash
git add db/schema/enums.ts
git commit -m "feat(schema): add subscriptionInterval and subscriptionStatus enums"
```

---

## Task 2: Create `db/schema/subscriptions.ts` and export it

**Files:**
- Create: `db/schema/subscriptions.ts`
- Modify: `db/schema/index.ts`

- [ ] **Step 1: Create the schema file**

Create `db/schema/subscriptions.ts` with the following content:

```typescript
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { cookProfiles } from "./cooks";
import { subscriptionInterval, subscriptionStatus } from "./enums";
import { listings } from "./listings";

const isAdmin = sql`auth.role() = 'admin'`;
const isServiceRole = sql`auth.role() = 'service_role'`;

// ─── Listing Subscription Tiers ───────────────────────────────────────────────
// One row per interval option a cook offers on a subscription listing.
// At most one tier per (listing, interval) pair — enforced by unique index.

export const listingSubscriptionTiers = pgTable(
  "listing_subscription_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    interval: subscriptionInterval("interval").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    stripePriceId: text("stripe_price_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("listing_interval_uidx").on(t.listingId, t.interval),
    check("tier_price_positive", sql`${t.price} > 0`),
    pgPolicy("tiers_select_public", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT id FROM listings WHERE status = 'active') AND is_active = TRUE`,
    }),
    pgPolicy("tiers_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("tiers_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("tiers_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isServiceRole,
    }),
    pgPolicy("tiers_update_service", {
      for: "update",
      to: "public",
      using: isServiceRole,
    }),
    pgPolicy("tiers_delete_service", {
      for: "delete",
      to: "public",
      using: isServiceRole,
    }),
  ],
).enableRLS();

// ─── Client Subscriptions ─────────────────────────────────────────────────────
// One row per client-listing-tier subscription. Source of truth for who is
// subscribed to what. The Stripe subscription ID is the join key for webhooks.

export const clientSubscriptions = pgTable(
  "client_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => listingSubscriptionTiers.id, { onDelete: "restrict" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    status: subscriptionStatus("status").notNull().default("active"),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    pgPolicy("subscriptions_select_client", {
      for: "select",
      to: "public",
      using: sql`client_id = auth.uid()`,
    }),
    pgPolicy("subscriptions_select_cook", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("subscriptions_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("subscriptions_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isServiceRole,
    }),
    pgPolicy("subscriptions_update_service", {
      for: "update",
      to: "public",
      using: isServiceRole,
    }),
  ],
).enableRLS();
```

- [ ] **Step 2: Export from `db/schema/index.ts`**

Add `export * from "./subscriptions";` to `db/schema/index.ts` after the existing exports:

```typescript
export * from "./applications";
export * from "./auth";
export * from "./cooks";
export * from "./dishes";
export * from "./enums";
export * from "./listings";
export * from "./orders";
export * from "./payments";
export * from "./subscriptions";
export * from "./tags";
export * from "./waitlist";
```

- [ ] **Step 3: Type-check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add db/schema/subscriptions.ts db/schema/index.ts
git commit -m "feat(schema): add listing_subscription_tiers and client_subscriptions tables"
```

---

## Task 3: Modify existing schemas + run migration

**Files:**
- Modify: `db/schema/auth.ts` — add `stripeCustomerId`
- Modify: `db/schema/listings.ts` — add `stripeProductId`
- Modify: `db/schema/orders.ts` — add `subscriptionId` FK

- [ ] **Step 1: Add `stripeCustomerId` to `authUser` in `db/schema/auth.ts`**

In the `authUser` table definition, add after `phoneVerified`:

```typescript
stripeCustomerId: text("stripe_customer_id"),
```

- [ ] **Step 2: Add `stripeProductId` to `listings` in `db/schema/listings.ts`**

In the `listings` table definition, add after `coverPhotoUrl`:

```typescript
stripeProductId: text("stripe_product_id"),
```

- [ ] **Step 3: Add `subscriptionId` to `orders` in `db/schema/orders.ts`**

First add the import for `clientSubscriptions` at the top of `db/schema/orders.ts`. Add it to the existing imports from `./listings`:

```typescript
import { listingPromotions, listings } from "./listings";
import { clientSubscriptions } from "./subscriptions";
```

Then in the `orders` table definition, add after `notes`:

```typescript
subscriptionId: uuid("subscription_id").references(
  () => clientSubscriptions.id,
  { onDelete: "set null" },
),
```

- [ ] **Step 4: Generate the migration**

```bash
pnpm db:generate
```

Expected: a new file created in `db/migrations/` with the ALTER TABLE and CREATE TABLE statements.

- [ ] **Step 5: Apply the migration**

```bash
pnpm db:migrate
```

Expected: `migrations applied successfully` (or similar). Verify no errors.

- [ ] **Step 6: Type-check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add db/schema/auth.ts db/schema/listings.ts db/schema/orders.ts db/migrations/
git commit -m "feat(schema): add stripe fields to user/listings, subscription_id to orders, run migration"
```

---

## Task 4: Stripe subscription helper library

**Files:**
- Create: `lib/stripe-subscriptions.ts`
- Create: `lib/stripe-subscriptions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/stripe-subscriptions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { INTERVAL_MAP } from "./stripe-subscriptions";

describe("INTERVAL_MAP", () => {
  it("maps weekly to Stripe week/1", () => {
    expect(INTERVAL_MAP.weekly).toEqual({ interval: "week", interval_count: 1 });
  });

  it("maps biweekly to Stripe week/2", () => {
    expect(INTERVAL_MAP.biweekly).toEqual({
      interval: "week",
      interval_count: 2,
    });
  });

  it("maps monthly to Stripe month/1", () => {
    expect(INTERVAL_MAP.monthly).toEqual({
      interval: "month",
      interval_count: 1,
    });
  });

  it("covers all three intervals", () => {
    expect(Object.keys(INTERVAL_MAP)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:run lib/stripe-subscriptions.test.ts
```

Expected: FAIL — `Cannot find module './stripe-subscriptions'`

- [ ] **Step 3: Create `lib/stripe-subscriptions.ts`**

```typescript
import Stripe from "stripe";

export type SubscriptionInterval = "weekly" | "biweekly" | "monthly";

export const INTERVAL_MAP: Record<
  SubscriptionInterval,
  { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number }
> = {
  weekly: { interval: "week", interval_count: 1 },
  biweekly: { interval: "week", interval_count: 2 },
  monthly: { interval: "month", interval_count: 1 },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function getOrCreateStripeProduct(
  connectedAccountId: string,
  listingId: string,
  title: string,
): Promise<string> {
  const stripe = getStripe();
  const product = await stripe.products.create(
    { name: title, metadata: { listing_id: listingId } },
    { stripeAccount: connectedAccountId },
  );
  return product.id;
}

export async function createStripePrice(
  connectedAccountId: string,
  productId: string,
  interval: SubscriptionInterval,
  priceInCents: number,
): Promise<string> {
  const stripe = getStripe();
  const { interval: stripeInterval, interval_count } = INTERVAL_MAP[interval];
  const price = await stripe.prices.create(
    {
      product: productId,
      unit_amount: priceInCents,
      currency: "cad",
      recurring: { interval: stripeInterval, interval_count },
    },
    { stripeAccount: connectedAccountId },
  );
  return price.id;
}

export async function archiveStripePrice(
  connectedAccountId: string,
  priceId: string,
): Promise<void> {
  const stripe = getStripe();
  await stripe.prices.update(
    priceId,
    { active: false },
    { stripeAccount: connectedAccountId },
  );
}

export async function getOrCreateStripeCustomer(
  email: string,
  name: string,
): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}

export async function createStripeSubscription(params: {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  applicationFeePct: number;
  connectedAccountId: string;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    default_payment_method: params.paymentMethodId,
    application_fee_percent: params.applicationFeePct,
    transfer_data: { destination: params.connectedAccountId },
    payment_settings: {
      payment_method_options: {
        card: { capture_method: "manual" },
      },
      save_default_payment_method: "on_subscription",
    },
  });
}

export async function cancelStripeSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean,
): Promise<void> {
  const stripe = getStripe();
  if (atPeriodEnd) {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    await stripe.subscriptions.cancel(subscriptionId);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test:run lib/stripe-subscriptions.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/stripe-subscriptions.ts lib/stripe-subscriptions.test.ts
git commit -m "feat(lib): add stripe-subscriptions helper with interval mapping"
```

---

## Task 5: Cook-side tier management API

**Files:**
- Create: `app/api/business/listings/[listingId]/tiers/route.ts`
- Create: `app/api/business/listings/[listingId]/tiers/[tierId]/route.ts`

- [ ] **Step 1: Create `app/api/business/listings/[listingId]/tiers/route.ts`**

```typescript
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles, listingSubscriptionTiers, listings } from "@/db/schema";
import {
  createStripePrice,
  getOrCreateStripeProduct,
} from "@/lib/stripe-subscriptions";

export type Params = { params: Promise<{ listingId: string }> };

const createTierSchema = z.object({
  interval: z.enum(["weekly", "biweekly", "monthly"]),
  price: z.number().positive(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    const tiers = await db
      .select()
      .from(listingSubscriptionTiers)
      .where(eq(listingSubscriptionTiers.listingId, listingId))
      .orderBy(listingSubscriptionTiers.interval);

    return NextResponse.json({ success: true, data: tiers });
  } catch (err) {
    console.error("[tiers/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch tiers." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = createTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { interval, price } = parsed.data;

  try {
    const [listing] = await db
      .select({
        id: listings.id,
        type: listings.type,
        title: listings.title,
        stripeProductId: listings.stripeProductId,
      })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    if (listing.type !== "subscription") {
      return NextResponse.json(
        { error: "Tiers can only be added to subscription listings." },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ id: listingSubscriptionTiers.id })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.interval, interval),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: `A ${interval} tier already exists for this listing.` },
        { status: 409 },
      );
    }

    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook?.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not connected." },
        { status: 400 },
      );
    }

    let stripeProductId = listing.stripeProductId;
    if (!stripeProductId) {
      stripeProductId = await getOrCreateStripeProduct(
        cook.stripeAccountId,
        listingId,
        listing.title,
      );
      await db
        .update(listings)
        .set({ stripeProductId })
        .where(eq(listings.id, listingId));
    }

    const priceInCents = Math.round(price * 100);
    const stripePriceId = await createStripePrice(
      cook.stripeAccountId,
      stripeProductId,
      interval,
      priceInCents,
    );

    const [tier] = await db
      .insert(listingSubscriptionTiers)
      .values({ listingId, interval, price: String(price), stripePriceId })
      .returning();

    // Keep base_price as the cheapest active tier for display purposes
    const allTiers = await db
      .select({ price: listingSubscriptionTiers.price })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.isActive, true),
        ),
      );

    const cheapest = Math.min(...allTiers.map((t) => parseFloat(t.price)));
    await db
      .update(listings)
      .set({ basePrice: String(cheapest) })
      .where(eq(listings.id, listingId));

    return NextResponse.json({ success: true, data: tier }, { status: 201 });
  } catch (err) {
    console.error("[tiers/POST]", err);
    return NextResponse.json(
      { error: "Failed to create tier." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create `app/api/business/listings/[listingId]/tiers/[tierId]/route.ts`**

```typescript
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import {
  clientSubscriptions,
  cookProfiles,
  listingSubscriptionTiers,
  listings,
} from "@/db/schema";
import {
  archiveStripePrice,
  createStripePrice,
} from "@/lib/stripe-subscriptions";

export type Params = {
  params: Promise<{ listingId: string; tierId: string }>;
};

const patchTierSchema = z
  .object({
    price: z.number().positive(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required.",
  });

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, tierId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = patchTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    const [tier] = await db
      .select()
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.id, tierId),
          eq(listingSubscriptionTiers.listingId, listingId),
        ),
      )
      .limit(1);

    if (!tier) return notFound("Tier");

    const updateFields: Partial<typeof listingSubscriptionTiers.$inferInsert> =
      {};

    if (parsed.data.isActive !== undefined) {
      updateFields.isActive = parsed.data.isActive;
    }

    if (parsed.data.price !== undefined) {
      // Price changes require a new Stripe Price (old one archived)
      const [cook] = await db
        .select({ stripeAccountId: cookProfiles.stripeAccountId })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1);

      if (!cook?.stripeAccountId) {
        return NextResponse.json(
          { error: "Stripe account not connected." },
          { status: 400 },
        );
      }

      const [listing2] = await db
        .select({ stripeProductId: listings.stripeProductId })
        .from(listings)
        .where(eq(listings.id, listingId))
        .limit(1);

      if (!listing2?.stripeProductId) {
        return NextResponse.json(
          { error: "Listing has no Stripe product." },
          { status: 400 },
        );
      }

      if (tier.stripePriceId) {
        await archiveStripePrice(cook.stripeAccountId, tier.stripePriceId);
      }

      const newPriceId = await createStripePrice(
        cook.stripeAccountId,
        listing2.stripeProductId,
        tier.interval,
        Math.round(parsed.data.price * 100),
      );

      updateFields.price = String(parsed.data.price);
      updateFields.stripePriceId = newPriceId;
    }

    const [updated] = await db
      .update(listingSubscriptionTiers)
      .set(updateFields)
      .where(eq(listingSubscriptionTiers.id, tierId))
      .returning();

    // Sync base_price on listing to cheapest active tier
    const allTiers = await db
      .select({ price: listingSubscriptionTiers.price })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.isActive, true),
        ),
      );

    if (allTiers.length > 0) {
      const cheapest = Math.min(...allTiers.map((t) => parseFloat(t.price)));
      await db
        .update(listings)
        .set({ basePrice: String(cheapest) })
        .where(eq(listings.id, listingId));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[tiers/PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update tier." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId, tierId } = await params;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
      .limit(1);

    if (!listing) return notFound("Listing");

    const [tier] = await db
      .select()
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.id, tierId),
          eq(listingSubscriptionTiers.listingId, listingId),
        ),
      )
      .limit(1);

    if (!tier) return notFound("Tier");

    // Block deletion if active subscribers on this tier
    const [activeSub] = await db
      .select({ id: clientSubscriptions.id })
      .from(clientSubscriptions)
      .where(
        and(
          eq(clientSubscriptions.tierId, tierId),
          eq(clientSubscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (activeSub) {
      return NextResponse.json(
        { error: "Cannot deactivate a tier with active subscribers." },
        { status: 409 },
      );
    }

    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (cook?.stripeAccountId && tier.stripePriceId) {
      await archiveStripePrice(cook.stripeAccountId, tier.stripePriceId);
    }

    await db
      .update(listingSubscriptionTiers)
      .set({ isActive: false })
      .where(eq(listingSubscriptionTiers.id, tierId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[tiers/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to deactivate tier." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm build
```

Expected: no errors in these new files.

- [ ] **Step 4: Commit**

```bash
git add app/api/business/listings/
git commit -m "feat(api): add cook-side tier management endpoints"
```

---

## Task 6: Client auth helper + subscribe endpoint

**Files:**
- Create: `app/api/subscriptions/_lib/client-auth.ts`
- Create: `app/api/subscriptions/route.ts`

- [ ] **Step 1: Create `app/api/subscriptions/_lib/client-auth.ts`**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function getClientSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

export const unauthorized = () =>
  NextResponse.json({ error: "Not authenticated." }, { status: 401 });

export const notFound = (entity: string) =>
  NextResponse.json({ error: `${entity} not found.` }, { status: 404 });

export const forbidden = () =>
  NextResponse.json({ error: "Access denied." }, { status: 403 });
```

- [ ] **Step 2: Create `app/api/subscriptions/route.ts`**

```typescript
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidden,
  getClientSession,
  notFound,
  unauthorized,
} from "./_lib/client-auth";
import { db } from "@/db";
import {
  authUser,
  clientSubscriptions,
  cookProfiles,
  listingSubscriptionTiers,
  listings,
} from "@/db/schema";
import {
  createStripeSubscription,
  getOrCreateStripeCustomer,
} from "@/lib/stripe-subscriptions";

const subscribeSchema = z.object({
  listingId: z.uuid(),
  tierId: z.uuid(),
  paymentMethodId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  try {
    const subs = await db
      .select({
        id: clientSubscriptions.id,
        status: clientSubscriptions.status,
        cancelAtPeriodEnd: clientSubscriptions.cancelAtPeriodEnd,
        currentPeriodEnd: clientSubscriptions.currentPeriodEnd,
        createdAt: clientSubscriptions.createdAt,
        listing: {
          id: listings.id,
          title: listings.title,
        },
        tier: {
          id: listingSubscriptionTiers.id,
          interval: listingSubscriptionTiers.interval,
          price: listingSubscriptionTiers.price,
        },
      })
      .from(clientSubscriptions)
      .innerJoin(listings, eq(clientSubscriptions.listingId, listings.id))
      .innerJoin(
        listingSubscriptionTiers,
        eq(clientSubscriptions.tierId, listingSubscriptionTiers.id),
      )
      .where(eq(clientSubscriptions.clientId, session.user.id))
      .orderBy(desc(clientSubscriptions.createdAt));

    return NextResponse.json({ success: true, data: subs });
  } catch (err) {
    console.error("[subscriptions/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  if (session.user.role !== "client") {
    return forbidden();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { listingId, tierId, paymentMethodId } = parsed.data;

  try {
    // Verify listing is active + subscription type
    const [listing] = await db
      .select({ id: listings.id, cookId: listings.cookId, type: listings.type })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.status, "active")))
      .limit(1);

    if (!listing) return notFound("Listing");
    if (listing.type !== "subscription") {
      return NextResponse.json(
        { error: "This listing does not support subscriptions." },
        { status: 400 },
      );
    }

    // Verify tier is active + belongs to listing
    const [tier] = await db
      .select({
        id: listingSubscriptionTiers.id,
        stripePriceId: listingSubscriptionTiers.stripePriceId,
        interval: listingSubscriptionTiers.interval,
      })
      .from(listingSubscriptionTiers)
      .where(
        and(
          eq(listingSubscriptionTiers.id, tierId),
          eq(listingSubscriptionTiers.listingId, listingId),
          eq(listingSubscriptionTiers.isActive, true),
        ),
      )
      .limit(1);

    if (!tier?.stripePriceId) return notFound("Tier");

    // Prevent duplicate active subscriptions
    const [duplicate] = await db
      .select({ id: clientSubscriptions.id })
      .from(clientSubscriptions)
      .where(
        and(
          eq(clientSubscriptions.clientId, session.user.id),
          eq(clientSubscriptions.listingId, listingId),
          eq(clientSubscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        { error: "You already have an active subscription to this listing." },
        { status: 409 },
      );
    }

    // Load cook's stripe account
    const [cook] = await db
      .select({
        stripeAccountId: cookProfiles.stripeAccountId,
        platformFeePct: cookProfiles.platformFeePct,
      })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, listing.cookId))
      .limit(1);

    if (!cook?.stripeAccountId) {
      return NextResponse.json(
        { error: "Cook Stripe account not connected." },
        { status: 400 },
      );
    }

    // Get or create Stripe Customer for this client.
    // Always fetch from DB — Better Auth's session type may not include stripeCustomerId.
    const [userRow] = await db
      .select({
        stripeCustomerId: authUser.stripeCustomerId,
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
      })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    let stripeCustomerId = userRow?.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const name =
        [userRow?.firstName, userRow?.lastName].filter(Boolean).join(" ") ||
        session.user.email;
      stripeCustomerId = await getOrCreateStripeCustomer(
        session.user.email,
        name,
      );

      await db
        .update(authUser)
        .set({ stripeCustomerId })
        .where(eq(authUser.id, session.user.id));
    }

    // Create Stripe Subscription with manual capture
    const stripeSub = await createStripeSubscription({
      customerId: stripeCustomerId,
      priceId: tier.stripePriceId,
      paymentMethodId,
      applicationFeePct: parseFloat(cook.platformFeePct),
      connectedAccountId: cook.stripeAccountId,
    });

    // Persist client_subscriptions row
    const [sub] = await db
      .insert(clientSubscriptions)
      .values({
        clientId: session.user.id,
        listingId,
        tierId,
        cookId: listing.cookId,
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      })
      .returning();

    // Note: the first order is created by the invoice.payment_succeeded webhook,
    // not here. Stripe fires that event synchronously after subscription creation.

    return NextResponse.json({ success: true, data: sub }, { status: 201 });
  } catch (err) {
    console.error("[subscriptions/POST]", err);
    return NextResponse.json(
      { error: "Failed to create subscription." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm build
```

Expected: no errors. If `session.user.stripeCustomerId` shows a type error, the schema migration from Task 3 may need to be regenerated — confirm `authUser` in `db/schema/auth.ts` has `stripeCustomerId`.

- [ ] **Step 4: Commit**

```bash
git add app/api/subscriptions/
git commit -m "feat(api): add client subscription list + subscribe endpoints"
```

---

## Task 7: Subscription detail + cancel endpoints

**Files:**
- Create: `app/api/subscriptions/[subscriptionId]/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidden,
  getClientSession,
  notFound,
  unauthorized,
} from "../_lib/client-auth";
import { db } from "@/db";
import {
  clientSubscriptions,
  listingSubscriptionTiers,
  listings,
  orders,
} from "@/db/schema";
import { cancelStripeSubscription } from "@/lib/stripe-subscriptions";

export type Params = { params: Promise<{ subscriptionId: string }> };

const subscriptionIdSchema = z.uuid();

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  const { subscriptionId } = await params;

  if (!subscriptionIdSchema.safeParse(subscriptionId).success) {
    return NextResponse.json(
      { error: "Invalid subscription ID." },
      { status: 400 },
    );
  }

  try {
    const [sub] = await db
      .select({
        id: clientSubscriptions.id,
        status: clientSubscriptions.status,
        cancelAtPeriodEnd: clientSubscriptions.cancelAtPeriodEnd,
        currentPeriodStart: clientSubscriptions.currentPeriodStart,
        currentPeriodEnd: clientSubscriptions.currentPeriodEnd,
        cancelledAt: clientSubscriptions.cancelledAt,
        createdAt: clientSubscriptions.createdAt,
        listing: {
          id: listings.id,
          title: listings.title,
          coverPhotoUrl: listings.coverPhotoUrl,
        },
        tier: {
          id: listingSubscriptionTiers.id,
          interval: listingSubscriptionTiers.interval,
          price: listingSubscriptionTiers.price,
        },
      })
      .from(clientSubscriptions)
      .innerJoin(listings, eq(clientSubscriptions.listingId, listings.id))
      .innerJoin(
        listingSubscriptionTiers,
        eq(clientSubscriptions.tierId, listingSubscriptionTiers.id),
      )
      .where(
        and(
          eq(clientSubscriptions.id, subscriptionId),
          eq(clientSubscriptions.clientId, session.user.id),
        ),
      )
      .limit(1);

    if (!sub) return notFound("Subscription");

    // Attach recent orders for this subscription
    const recentOrders = await db
      .select({
        id: orders.id,
        status: orders.status,
        pickupAt: orders.pickupAt,
        totalPrice: orders.totalPrice,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.subscriptionId, subscriptionId))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    return NextResponse.json({
      success: true,
      data: { ...sub, recentOrders },
    });
  } catch (err) {
    console.error("[subscriptions/GET one]", err);
    return NextResponse.json(
      { error: "Failed to fetch subscription." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  const { subscriptionId } = await params;

  if (!subscriptionIdSchema.safeParse(subscriptionId).success) {
    return NextResponse.json(
      { error: "Invalid subscription ID." },
      { status: 400 },
    );
  }

  // ?immediate=true cancels now; default is cancel at period end
  const immediate =
    new URL(req.url).searchParams.get("immediate") === "true";

  try {
    const [sub] = await db
      .select({
        id: clientSubscriptions.id,
        clientId: clientSubscriptions.clientId,
        status: clientSubscriptions.status,
        stripeSubscriptionId: clientSubscriptions.stripeSubscriptionId,
      })
      .from(clientSubscriptions)
      .where(eq(clientSubscriptions.id, subscriptionId))
      .limit(1);

    if (!sub) return notFound("Subscription");

    if (sub.clientId !== session.user.id) return forbidden();

    if (sub.status === "cancelled") {
      return NextResponse.json(
        { error: "Subscription is already cancelled." },
        { status: 400 },
      );
    }

    await cancelStripeSubscription(
      sub.stripeSubscriptionId,
      !immediate,
    );

    const updateFields: Partial<typeof clientSubscriptions.$inferInsert> =
      immediate
        ? { status: "cancelled", cancelledAt: new Date() }
        : { cancelAtPeriodEnd: true };

    const [updated] = await db
      .update(clientSubscriptions)
      .set(updateFields)
      .where(eq(clientSubscriptions.id, subscriptionId))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[subscriptions/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to cancel subscription." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/subscriptions/[subscriptionId]/
git commit -m "feat(api): add subscription detail and cancel endpoints"
```

---

## Task 8: Webhook — invoice + subscription event handlers

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

The webhook already handles payout events. Add four new event handlers inside the existing `switch` block.

- [ ] **Step 1: Add imports to the webhook file**

At the top of `app/api/webhooks/stripe/route.ts`, update the imports:

```typescript
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import {
  clientSubscriptions,
  cookPayouts,
  cookProfiles,
  dishes,
  listingDishes,
  listingSubscriptionTiers,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
```

- [ ] **Step 2: Add the four new cases inside the `switch (event.type)` block**

Add these cases after the existing `"account.updated":` case and before `default:`:

```typescript
case "invoice.payment_succeeded": {
  const invoice = event.data.object as Stripe.Invoice;

  // Only process subscription invoices (not one-time)
  if (!invoice.subscription || typeof invoice.subscription !== "string") break;

  const [sub] = await db
    .select({
      id: clientSubscriptions.id,
      clientId: clientSubscriptions.clientId,
      listingId: clientSubscriptions.listingId,
      tierId: clientSubscriptions.tierId,
      cookId: clientSubscriptions.cookId,
    })
    .from(clientSubscriptions)
    .where(
      eq(clientSubscriptions.stripeSubscriptionId, invoice.subscription),
    )
    .limit(1);

  if (!sub) break;

  const [tier] = await db
    .select({ price: listingSubscriptionTiers.price })
    .from(listingSubscriptionTiers)
    .where(eq(listingSubscriptionTiers.id, sub.tierId))
    .limit(1);

  if (!tier) break;

  const [cook] = await db
    .select({ platformFeePct: cookProfiles.platformFeePct })
    .from(cookProfiles)
    .where(eq(cookProfiles.id, sub.cookId))
    .limit(1);

  if (!cook) break;

  const unitPrice = tier.price;
  const totalPrice = unitPrice;
  const periodEnd = invoice.period_end
    ? new Date(invoice.period_end * 1000)
    : new Date();

  const [order] = await db
    .insert(orders)
    .values({
      clientId: sub.clientId,
      listingId: sub.listingId,
      cookId: sub.cookId,
      subscriptionId: sub.id,
      status: "pending",
      quantity: 1,
      unitPrice,
      totalPrice,
      currency: "CAD",
      pickupAt: periodEnd,
    })
    .returning();

  // Snapshot the listing's current dishes into order_dishes
  const listingDishRows = await db
    .select({
      dishId: listingDishes.dishId,
      quantity: listingDishes.quantity,
      sortOrder: listingDishes.sortOrder,
      dishName: dishes.name,
    })
    .from(listingDishes)
    .innerJoin(dishes, eq(listingDishes.dishId, dishes.id))
    .where(eq(listingDishes.listingId, sub.listingId));

  if (listingDishRows.length > 0) {
    await db.insert(orderDishes).values(
      listingDishRows.map((d) => ({
        orderId: order.id,
        dishId: d.dishId,
        dishName: d.dishName,
        quantity: d.quantity,
        sortOrder: d.sortOrder,
      })),
    );
  }

  const feePct = parseFloat(cook.platformFeePct);
  const total = parseFloat(totalPrice);
  const platformFeeAmount = ((feePct / 100) * total).toFixed(2);
  const cookPayoutAmount = (total - parseFloat(platformFeeAmount)).toFixed(2);

  const paymentIntentId =
    typeof invoice.payment_intent === "string"
      ? invoice.payment_intent
      : invoice.payment_intent?.id ?? null;

  await db.insert(orderPayments).values({
    orderId: order.id,
    cookId: sub.cookId,
    clientId: sub.clientId,
    status: "authorized",
    totalAmount: totalPrice,
    platformFeePct: cook.platformFeePct,
    platformFeeAmount,
    cookPayoutAmount,
    currency: "CAD",
    stripePaymentIntentId: paymentIntentId,
    authorizedAt: new Date(),
  });

  // Sync subscription period dates
  await db
    .update(clientSubscriptions)
    .set({
      currentPeriodStart: new Date(invoice.period_start * 1000),
      currentPeriodEnd: periodEnd,
    })
    .where(eq(clientSubscriptions.id, sub.id));

  break;
}

case "invoice.payment_failed": {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.subscription || typeof invoice.subscription !== "string") break;

  await db
    .update(clientSubscriptions)
    .set({ status: "past_due" })
    .where(
      eq(clientSubscriptions.stripeSubscriptionId, invoice.subscription),
    );

  break;
}

case "customer.subscription.deleted": {
  const subscription = event.data.object as Stripe.Subscription;

  await db
    .update(clientSubscriptions)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      eq(clientSubscriptions.stripeSubscriptionId, subscription.id),
    );

  break;
}

case "customer.subscription.updated": {
  const subscription = event.data.object as Stripe.Subscription;

  await db
    .update(clientSubscriptions)
    .set({
      status:
        subscription.status === "active"
          ? "active"
          : subscription.status === "past_due"
            ? "past_due"
            : subscription.status === "canceled"
              ? "cancelled"
              : "paused",
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: new Date(
        subscription.current_period_start * 1000,
      ),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })
    .where(
      eq(clientSubscriptions.stripeSubscriptionId, subscription.id),
    );

  break;
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat(webhook): handle invoice and subscription lifecycle events"
```

---

## Task 9: Add payment capture to verify-code

**Files:**
- Modify: `app/api/business/dashboard/orders/[orderId]/verify-code/route.ts`

Currently this route marks orders as `fulfilled` but never captures the Stripe PaymentIntent. Add capture after code verification so funds are released to the cook.

- [ ] **Step 1: Add Stripe import and orderPayments import**

At the top of `verify-code/route.ts`, update imports to add:

```typescript
import Stripe from "stripe";
import { orderPayments } from "@/db/schema";
```

- [ ] **Step 2: Add capture logic after the fulfilled update**

Replace the successful fulfillment block (after setting `status: 'fulfilled'`) with:

```typescript
const fulfilledAt = new Date();
const [fulfilled] = await db
  .update(orders)
  .set({
    status: "fulfilled",
    pickupCodeVerifiedAt: fulfilledAt,
    fulfilledAt,
  })
  .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
  .returning({ id: orders.id, fulfilledAt: orders.fulfilledAt });

// Capture the held PaymentIntent to release funds to the cook
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (stripeKey && fulfilled) {
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });

  const [payment] = await db
    .select({
      stripePaymentIntentId: orderPayments.stripePaymentIntentId,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId))
    .limit(1);

  if (payment?.stripePaymentIntentId) {
    await stripe.paymentIntents.capture(payment.stripePaymentIntentId);
    await db
      .update(orderPayments)
      .set({ status: "released", releasedAt: fulfilledAt })
      .where(eq(orderPayments.orderId, orderId));
  }
}

return NextResponse.json({
  success: true,
  data: { orderId: fulfilled?.id, fulfilledAt: fulfilled?.fulfilledAt },
});
```

- [ ] **Step 3: Type-check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/business/dashboard/orders/
git commit -m "feat(orders): capture Stripe PaymentIntent on pickup code verification"
```

---

## Task 10: Update listing GET to include tiers

**Files:**
- Modify: `app/api/business/listings/[listingId]/route.ts`

- [ ] **Step 1: Add tiers to the GET response**

In `app/api/business/listings/[listingId]/route.ts`, update the `GET` handler to also fetch tiers. Add the import for `listingSubscriptionTiers` to the existing schema import line:

```typescript
import { dishes, listingDishes, listingSubscriptionTiers, listings } from "@/db/schema";
```

Then in the `GET` handler, after fetching `dishRows`, add:

```typescript
const tierRows = await db
  .select()
  .from(listingSubscriptionTiers)
  .where(eq(listingSubscriptionTiers.listingId, listingId))
  .orderBy(listingSubscriptionTiers.interval);

return NextResponse.json({
  success: true,
  data: { ...listing, dishes: dishRows, tiers: tierRows },
});
```

Replace the existing `return NextResponse.json(...)` call.

- [ ] **Step 2: Type-check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/business/listings/[listingId]/route.ts
git commit -m "feat(api): include subscription tiers in listing GET response"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm test:run` — 4 interval mapping tests pass
- [ ] In Stripe dashboard: creating a subscription listing tier creates a Product + Price on the connected account
- [ ] Subscribing a client: a Stripe Subscription is created with `capture_method: manual`
- [ ] `invoice.payment_succeeded` webhook creates an `orders` row, `order_payments` row, and `order_dishes` snapshot
- [ ] Verifying a pickup code captures the Stripe PaymentIntent and sets `order_payments.status = 'released'`
- [ ] Cancelling a subscription (graceful): `cancel_at_period_end = true`, Stripe subscription unchanged until period end
- [ ] Cancelling a subscription (immediate): Stripe subscription cancelled, `status = 'cancelled'`
- [ ] `customer.subscription.deleted` webhook sets `client_subscriptions.status = 'cancelled'`
