# Stripe Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the full Stripe payment stack — one-time orders with optional deposit escrow, subscription escrow, cook Express Connect onboarding, cancellations with late-cancel-fee and deposit logic, and all supporting webhooks — using real Stripe test credentials with no mocks.

**Architecture:** Destination charges on the 7eats platform account. All charges flow through the platform with `transfer_data` routing the cook's share; the platform keeps `application_fee_amount`. One-time orders use `capture_method: 'manual'` for escrow; subscription invoices are captured immediately on the platform and transferred manually at pickup. A deposit (when enabled) is a second `manual`-capture PI released to the cook on order confirmation.

**Tech Stack:** Next.js 16 App Router, Stripe SDK v22 (`stripe ^22.2.0`, API version `2026-05-27.dahlia`), Drizzle ORM + Neon Postgres, Vitest, Zod, TypeScript strict.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/stripe.ts` | Shared Stripe singleton |
| Modify | `lib/stripe-subscriptions.ts` | Import singleton; remove `stripeAccount` from product/price; fix subscription creation |
| Create | `lib/stripe-payments.ts` | One-time PI creation, capture, cancel, refund, transfer helpers |
| Modify | `db/schema/enums.ts` | Add `paymentTypeEnum` |
| Modify | `db/schema/listings.ts` | Add deposit fields |
| Modify | `db/schema/orders.ts` | Add deposit snapshot fields |
| Modify | `db/schema/payments.ts` | Drop column-level unique on `order_id`; add `type`; add composite unique index |
| Modify | `app/api/setup/stripe-connect/route.ts` | Replace mock with real Express account creation |
| Modify | `app/api/business/dashboard/stripe/status/route.ts` | Remove `isDevMode` mock block |
| Modify | `app/api/business/dashboard/stripe/onboarding-link/route.ts` | Remove mock URL block |
| Modify | `app/api/business/dashboard/stripe/dashboard-link/route.ts` | Remove mock URL block |
| Modify | `app/api/subscriptions/route.ts` | Remove `transfer_data` from `createStripeSubscription` call |
| Create | `app/api/orders/route.ts` | `POST /api/orders` — client order placement with Stripe PIs |
| Create | `app/api/orders/[orderId]/route.ts` | `DELETE /api/orders/[orderId]` — client order cancellation |
| Modify | `app/api/business/dashboard/orders/[orderId]/status/route.ts` | Release deposit on confirm; cancel/refund PIs on cook cancel |
| Modify | `app/api/business/dashboard/orders/[orderId]/verify-code/route.ts` | Handle `full`, `balance`, and subscription `held` payment variants |
| Modify | `app/api/webhooks/stripe/route.ts` | Remove insecure dev bypass; update subscription handler; add 3 new event handlers |
| Modify | `.env.local` | Add `STRIPE_WEBHOOK_SECRET` |
| Modify | `.env.example` | Add `STRIPE_WEBHOOK_SECRET` placeholder |
| Create | `__tests__/orders.test.ts` | Unit tests for `POST /api/orders` |
| Create | `__tests__/orders-cancel.test.ts` | Unit tests for `DELETE /api/orders/[orderId]` |

---

## Task 1: Extract Shared Stripe Singleton

**Files:**
- Create: `lib/stripe.ts`
- Modify: `lib/stripe-subscriptions.ts`

- [ ] **Step 1: Create `lib/stripe.ts`**

```typescript
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  }
  return _stripe;
}
```

- [ ] **Step 2: Update `lib/stripe-subscriptions.ts` to import from the new singleton**

Replace the local `getStripe` block (lines 19–27) with a single import:

```typescript
import { getStripe } from "@/lib/stripe";
```

Remove the `let _stripe: Stripe | null = null;` declaration and the local `function getStripe(): Stripe { ... }` entirely. Every other reference to `getStripe()` in the file stays as-is.

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run existing tests**

```bash
pnpm test:run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/stripe.ts lib/stripe-subscriptions.ts
git commit -m "refactor: extract shared Stripe singleton to lib/stripe.ts"
```

---

## Task 2: Schema — Add `paymentTypeEnum`

**Files:**
- Modify: `db/schema/enums.ts`

- [ ] **Step 1: Add the enum at the end of `db/schema/enums.ts`**

```typescript
export const paymentTypeEnum = pgEnum("payment_type", [
  "full",
  "deposit",
  "balance",
]);
```

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add db/schema/enums.ts
git commit -m "feat(schema): add paymentTypeEnum"
```

---

## Task 3: Schema — Deposit Fields on `listings`

**Files:**
- Modify: `db/schema/listings.ts`

- [ ] **Step 1: Add deposit columns to the `listings` table**

After the `cancellationNoticeDays` column, add:

```typescript
depositEnabled: boolean("deposit_enabled").notNull().default(false),
depositType: lateCancelFeeTypeEnum("deposit_type"),
depositValue: numeric("deposit_value", { precision: 10, scale: 2 }),
```

`lateCancelFeeTypeEnum` is already imported at the top of `listings.ts` — verify the import includes it; if not, add it to the existing import from `"./enums"`.

- [ ] **Step 2: Add check constraint inside the table's constraints array**

```typescript
check(
  "listings_deposit_value_positive",
  sql`${t.depositValue} IS NULL OR ${t.depositValue} > 0`,
),
```

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add db/schema/listings.ts
git commit -m "feat(schema): add deposit fields to listings"
```

---

## Task 4: Schema — Deposit Snapshot Fields on `orders`

**Files:**
- Modify: `db/schema/orders.ts`

- [ ] **Step 1: Add deposit snapshot columns to `orders`**

After the `lateCancelFeeApplied` column, add:

```typescript
depositEnabled: boolean("deposit_enabled").notNull().default(false),
depositType: lateCancelFeeTypeEnum("deposit_type"),
depositValue: numeric("deposit_value", { precision: 10, scale: 2 }),
depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
```

`lateCancelFeeTypeEnum` is already imported in `orders.ts`.

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add db/schema/orders.ts
git commit -m "feat(schema): add deposit snapshot fields to orders"
```

---

## Task 5: Schema — Fix `order_payments` for Multi-Row Support

**Files:**
- Modify: `db/schema/payments.ts`

- [ ] **Step 1: Import `paymentTypeEnum` and `uniqueIndex` in `db/schema/payments.ts`**

Add `paymentTypeEnum` to the import from `"./enums"`. Add `uniqueIndex` to the import from `"drizzle-orm/pg-core"`.

- [ ] **Step 2: Remove `.unique()` from the `orderId` column definition**

Change:
```typescript
orderId: uuid("order_id")
  .notNull()
  .unique()
  .references(() => orders.id, { onDelete: "cascade" }),
```
To:
```typescript
orderId: uuid("order_id")
  .notNull()
  .references(() => orders.id, { onDelete: "cascade" }),
```

- [ ] **Step 3: Add the `type` column after `orderId`**

```typescript
type: paymentTypeEnum("type").notNull().default("full"),
```

- [ ] **Step 4: Add composite unique index in the table constraints array**

```typescript
uniqueIndex("order_payments_order_type_uidx").on(t.orderId, t.type),
```

- [ ] **Step 5: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add db/schema/payments.ts
git commit -m "feat(schema): support multi-row order_payments with type field"
```

---

## Task 6: Generate and Push Migrations

- [ ] **Step 1: Generate migration files**

```bash
pnpm db:generate
```

Expected: new migration files created under `drizzle/` (or similar output directory).

- [ ] **Step 2: Push schema to Neon**

```bash
pnpm exec drizzle-kit push
```

Expected: output confirms all tables updated with no destructive changes flagged unexpectedly. If Drizzle warns about dropping the unique constraint on `order_id`, confirm — this is intentional.

- [ ] **Step 3: Run tests to confirm no regressions**

```bash
pnpm test:run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "chore: generate and apply schema migrations for Stripe integration"
```

---

## Task 7: Fix `lib/stripe-subscriptions.ts` — Platform-Level Products/Prices

**Files:**
- Modify: `lib/stripe-subscriptions.ts`

- [ ] **Step 1: Remove `stripeAccount` from `getOrCreateStripeProduct`**

In `getOrCreateStripeProduct`, remove `{ stripeAccount: connectedAccountId }` from both the `stripe.products.search` call and the `stripe.products.create` call. Also remove the `connectedAccountId` parameter from the function signature.

Updated signature and body:

```typescript
export async function getOrCreateStripeProduct(
  listingId: string,
  title: string,
): Promise<string> {
  try {
    const stripe = getStripe();
    const results = await stripe.products.search({
      query: `metadata['listing_id']:'${listingId}'`,
      limit: 1,
    });
    if (results.data.length > 0) return results.data[0].id;
    const product = await stripe.products.create({
      name: title,
      metadata: { listing_id: listingId },
    });
    return product.id;
  } catch (err) {
    throw new Error(
      `Stripe getOrCreateStripeProduct failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
```

- [ ] **Step 2: Remove `stripeAccount` from `createStripePrice`**

Updated signature and body:

```typescript
export async function createStripePrice(
  productId: string,
  interval: SubscriptionInterval,
  priceInCents: number,
): Promise<string> {
  try {
    const stripe = getStripe();
    const { interval: stripeInterval, interval_count } = INTERVAL_MAP[interval];
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: priceInCents,
      currency: PLATFORM_CURRENCY,
      recurring: { interval: stripeInterval, interval_count },
    });
    return price.id;
  } catch (err) {
    throw new Error(
      `Stripe createStripePrice failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
```

- [ ] **Step 3: Fix `createStripeSubscription` — remove `transfer_data` and `capture_method: 'manual'`**

Replace the full function body:

```typescript
export async function createStripeSubscription(params: {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  applicationFeePct: number;
  connectedAccountId: string;
}): Promise<Stripe.Subscription> {
  try {
    const stripe = getStripe();
    return stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      default_payment_method: params.paymentMethodId,
      application_fee_percent: params.applicationFeePct,
      on_behalf_of: params.connectedAccountId,
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
    });
  } catch (err) {
    throw new Error(
      `Stripe createStripeSubscription failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
```

Note: `on_behalf_of` is kept so Stripe knows which connected account the subscription is for (affects statement descriptors and bank reconciliation), but `transfer_data` is removed so funds land on the platform for manual transfer at pickup.

- [ ] **Step 4: Update the caller in `app/api/business/listings/[listingId]/tiers/route.ts`**

The call to `getOrCreateStripeProduct` now takes two args instead of three. Find:

```typescript
stripeProductId = await getOrCreateStripeProduct(
  cook.stripeAccountId,
  listingId,
  listing.title,
);
```

Replace with:

```typescript
stripeProductId = await getOrCreateStripeProduct(
  listingId,
  listing.title,
);
```

Similarly, `createStripePrice` now takes three args instead of four. Find:

```typescript
const stripePriceId = await createStripePrice(
  cook.stripeAccountId,
  stripeProductId,
  interval,
  priceInCents,
);
```

Replace with:

```typescript
const stripePriceId = await createStripePrice(
  stripeProductId,
  interval,
  priceInCents,
);
```

- [ ] **Step 5: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run tests**

```bash
pnpm test:run
```

Expected: all pass (existing `INTERVAL_MAP` tests still pass).

- [ ] **Step 7: Commit**

```bash
git add lib/stripe-subscriptions.ts app/api/business/listings/
git commit -m "fix: move Stripe products/prices to platform account; remove transfer_data from subscriptions"
```

---

## Task 8: Real Stripe Express Connect Account Creation

**Files:**
- Modify: `app/api/setup/stripe-connect/route.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "cook") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [cook] = await db
    .select({ stripeAccountId: cookProfiles.stripeAccountId })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  if (cook?.stripeAccountId) {
    return NextResponse.json({ success: true });
  }

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.create({
      type: "express",
      country: "CA",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await db
      .update(cookProfiles)
      .set({ stripeAccountId: account.id })
      .where(eq(cookProfiles.userId, session.user.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[setup/stripe-connect]", err);
    return NextResponse.json(
      { error: "Failed to create Stripe account." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check and lint**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add app/api/setup/stripe-connect/route.ts
git commit -m "feat: real Stripe Express Connect account creation"
```

---

## Task 9: Remove Mock Blocks from Dashboard Stripe Routes

**Files:**
- Modify: `app/api/business/dashboard/stripe/status/route.ts`
- Modify: `app/api/business/dashboard/stripe/onboarding-link/route.ts`
- Modify: `app/api/business/dashboard/stripe/dashboard-link/route.ts`

- [ ] **Step 1: Rewrite `status/route.ts`**

```typescript
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    const stripeAccountId = cook?.stripeAccountId ?? null;

    if (!stripeAccountId) {
      return NextResponse.json({
        success: true,
        data: {
          hasAccount: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          requirementsCount: 0,
          requirements: [],
        },
      });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const requirements = account.requirements?.currently_due ?? [];

    return NextResponse.json({
      success: true,
      data: {
        hasAccount: true,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        requirementsCount: requirements.length,
        requirements,
      },
    });
  } catch (err) {
    console.error("[dashboard/stripe/status]", err);
    return NextResponse.json(
      { error: "Failed to fetch Stripe status." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Rewrite `onboarding-link/route.ts`**

```typescript
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook?.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not found." },
        { status: 404 },
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const accountLink = await stripe.accountLinks.create({
      account: cook.stripeAccountId,
      refresh_url: `${appUrl}/dashboard/stripe/refresh`,
      return_url: `${appUrl}/dashboard/stripe/return`,
      type: "account_onboarding",
    });

    return NextResponse.json({ success: true, data: { url: accountLink.url } });
  } catch (err) {
    console.error("[dashboard/stripe/onboarding-link]", err);
    return NextResponse.json(
      { error: "Failed to generate onboarding link." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Rewrite `dashboard-link/route.ts`**

```typescript
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [cook] = await db
      .select({ stripeAccountId: cookProfiles.stripeAccountId })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook?.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not found." },
        { status: 404 },
      );
    }

    const stripe = getStripe();
    const loginLink = await stripe.accounts.createLoginLink(
      cook.stripeAccountId,
    );

    return NextResponse.json({ success: true, data: { url: loginLink.url } });
  } catch (err) {
    console.error("[dashboard/stripe/dashboard-link]", err);
    return NextResponse.json(
      { error: "Failed to generate dashboard link." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/business/dashboard/stripe/
git commit -m "feat: remove mock blocks — all dashboard Stripe routes use real API"
```

---

## Task 10: Remove `STRIPE_WEBHOOK_INSECURE_DEV` Bypass + Env Setup

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: Remove the insecure dev bypass from the webhook handler**

In `app/api/webhooks/stripe/route.ts`, replace the entire `getStripe` + signature verification block (lines 18–65) with:

```typescript
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const buf = Buffer.from(rawBody);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 },
    );
  }
```

The rest of the function (idempotency check and switch statement) stays unchanged for now.

- [ ] **Step 2: Add `STRIPE_WEBHOOK_SECRET` to `.env.example`**

After the `STRIPE_SECRET_KEY` line add:

```
STRIPE_WEBHOOK_SECRET=whsec_...   # stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

- [ ] **Step 3: Set up local webhook forwarding and add secret to `.env.local`**

In a separate terminal (keep it running while developing):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints a signing secret like `whsec_abc123...`. Add it to `.env.local`:

```
STRIPE_WEBHOOK_SECRET=whsec_<value-from-stripe-listen>
```

- [ ] **Step 4: Run tests**

The existing webhook tests stub env vars, so update the stub in `__tests__/webhooks-stripe.test.ts` — replace `vi.stubEnv("STRIPE_WEBHOOK_INSECURE_DEV", "1")` with `vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test")` and update the test that verifies the insecure dev bypass (it should now verify that missing secret returns 500):

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
  // ... rest of beforeEach
});
```

Remove or update the test `"fails closed with 500 when no secret is set and the dev bypass is off"` — the bypass no longer exists, so any test that relied on `STRIPE_WEBHOOK_INSECURE_DEV` needs to be updated.

```bash
pnpm test:run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts .env.example __tests__/webhooks-stripe.test.ts
git commit -m "feat: require real STRIPE_WEBHOOK_SECRET — remove insecure dev bypass"
```

---

## Task 11: Create `lib/stripe-payments.ts`

**Files:**
- Create: `lib/stripe-payments.ts`

- [ ] **Step 1: Create the file**

```typescript
import { getStripe } from "@/lib/stripe";

const PLATFORM_CURRENCY = "cad" as const;

export interface PaymentIntentResult {
  piId: string;
  status: string;
  clientSecret: string | null;
}

export async function createFullPaymentIntent(params: {
  totalAmountCents: number;
  platformFeeCents: number;
  stripeCustomerId: string;
  paymentMethodId: string;
  connectedAccountId: string;
  idempotencyKey: string;
}): Promise<PaymentIntentResult> {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.create(
    {
      amount: params.totalAmountCents,
      currency: PLATFORM_CURRENCY,
      customer: params.stripeCustomerId,
      payment_method: params.paymentMethodId,
      capture_method: "manual",
      confirm: true,
      transfer_data: { destination: params.connectedAccountId },
      application_fee_amount: params.platformFeeCents,
    },
    { idempotencyKey: params.idempotencyKey },
  );
  return { piId: pi.id, status: pi.status, clientSecret: pi.client_secret };
}

export async function createSplitPaymentIntents(params: {
  depositAmountCents: number;
  balanceAmountCents: number;
  depositPlatformFeeCents: number;
  balancePlatformFeeCents: number;
  stripeCustomerId: string;
  paymentMethodId: string;
  connectedAccountId: string;
  orderId: string;
}): Promise<{ deposit: PaymentIntentResult; balance: PaymentIntentResult }> {
  const stripe = getStripe();
  const [depositPi, balancePi] = await Promise.all([
    stripe.paymentIntents.create(
      {
        amount: params.depositAmountCents,
        currency: PLATFORM_CURRENCY,
        customer: params.stripeCustomerId,
        payment_method: params.paymentMethodId,
        capture_method: "manual",
        confirm: true,
        transfer_data: { destination: params.connectedAccountId },
        application_fee_amount: params.depositPlatformFeeCents,
      },
      { idempotencyKey: `deposit-${params.orderId}` },
    ),
    stripe.paymentIntents.create(
      {
        amount: params.balanceAmountCents,
        currency: PLATFORM_CURRENCY,
        customer: params.stripeCustomerId,
        payment_method: params.paymentMethodId,
        capture_method: "manual",
        confirm: true,
        transfer_data: { destination: params.connectedAccountId },
        application_fee_amount: params.balancePlatformFeeCents,
      },
      { idempotencyKey: `balance-${params.orderId}` },
    ),
  ]);
  return {
    deposit: { piId: depositPi.id, status: depositPi.status, clientSecret: depositPi.client_secret },
    balance: { piId: balancePi.id, status: balancePi.status, clientSecret: balancePi.client_secret },
  };
}

export async function capturePaymentIntent(
  piId: string,
  idempotencyKey: string,
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.capture(piId, {}, { idempotencyKey });
}

export async function partialCapturePaymentIntent(params: {
  piId: string;
  captureAmountCents: number;
  newPlatformFeeCents: number;
  idempotencyKey: string;
}): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.update(params.piId, {
    application_fee_amount: params.newPlatformFeeCents,
  });
  await stripe.paymentIntents.capture(
    params.piId,
    { amount_to_capture: params.captureAmountCents },
    { idempotencyKey: params.idempotencyKey },
  );
}

export async function cancelPaymentIntent(
  piId: string,
  idempotencyKey: string,
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.cancel(piId, {}, { idempotencyKey });
}

export async function refundPaymentIntent(params: {
  paymentIntentId: string;
  amountCents?: number;
  reverseTransfer?: boolean;
  idempotencyKey: string;
}): Promise<string> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create(
    {
      payment_intent: params.paymentIntentId,
      ...(params.amountCents !== undefined ? { amount: params.amountCents } : {}),
      reverse_transfer: params.reverseTransfer ?? false,
    },
    { idempotencyKey: params.idempotencyKey },
  );
  return refund.id;
}

export async function createSubscriptionTransfer(params: {
  amountCents: number;
  connectedAccountId: string;
  idempotencyKey: string;
}): Promise<string> {
  const stripe = getStripe();
  const transfer = await stripe.transfers.create(
    {
      amount: params.amountCents,
      currency: PLATFORM_CURRENCY,
      destination: params.connectedAccountId,
    },
    { idempotencyKey: params.idempotencyKey },
  );
  return transfer.id;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/stripe-payments.ts
git commit -m "feat: add stripe-payments.ts — one-time PI helpers"
```

---

## Task 12: `POST /api/orders` Route

**Files:**
- Create: `app/api/orders/route.ts`
- Create: `__tests__/orders.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `__tests__/orders.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbPool: {
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
    ),
  },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  dishes: {},
  listingDishes: {},
  listingPromotions: {},
  listings: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

const createPiMock = vi.fn();
const cancelPiMock = vi.fn();
vi.mock("@/lib/stripe-payments", () => ({
  createFullPaymentIntent: createPiMock,
  createSplitPaymentIntents: vi.fn(),
  cancelPaymentIntent: cancelPiMock,
}));

vi.mock("@/lib/stripe-subscriptions", () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue("cus_test"),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/orders/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

const VALID_BODY = {
  listingId: "00000000-0000-0000-0000-000000000001",
  quantity: 1,
  paymentMethodId: "pm_test_123",
  pickupAt: new Date(Date.now() + 86400000).toISOString(),
};

const ACTIVE_LISTING = {
  id: "00000000-0000-0000-0000-000000000001",
  cookId: "00000000-0000-0000-0000-000000000002",
  type: "one_time",
  status: "active",
  basePrice: "20.00",
  minOrderQty: 1,
  maxOrderQty: null,
  depositEnabled: false,
  depositType: null,
  depositValue: null,
  title: "Test Listing",
};

const COOK = {
  stripeAccountId: "acct_test",
  platformFeePct: "7.50",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", role: "client", email: "client@test.com" },
  } as never);
  createPiMock.mockResolvedValue({
    piId: "pi_test",
    status: "requires_capture",
    clientSecret: null,
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/orders", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is a cook not a client", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "cook", email: "cook@test.com" },
    } as never);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 404 when listing is not active", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([]); // listing not found
      return limitChain([]);
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 400 when listing type is subscription", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1)
        return limitChain([{ ...ACTIVE_LISTING, type: "subscription" }]);
      return limitChain([]);
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/subscription/i);
  });

  it("returns 400 when cook has no Stripe account", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([ACTIVE_LISTING]);
      if (call === 2) return limitChain([{ stripeAccountId: null, platformFeePct: "7.50" }]);
      return limitChain([]);
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("creates order and payment intent for a no-deposit listing", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([ACTIVE_LISTING]);
      if (call === 2) return limitChain([COOK]);
      if (call === 3)
        return limitChain([{
          stripeCustomerId: "cus_existing",
          email: "c@t.com",
          firstName: "A",
          lastName: "B",
        }]);
      return limitChain([]);
    });
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    } as never);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orderId).toBeDefined();
    expect(createPiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmountCents: 2000,
        platformFeeCents: 150,
        connectedAccountId: "acct_test",
      }),
    );
  });

  it("cancels the PI and returns 500 when DB transaction fails", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([ACTIVE_LISTING]);
      if (call === 2) return limitChain([COOK]);
      if (call === 3)
        return limitChain([{ stripeCustomerId: "cus_existing", email: "c@t.com" }]);
      return limitChain([]);
    });
    const { dbPool } = await import("@/db");
    vi.mocked(dbPool.transaction).mockRejectedValue(new Error("db error"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect(cancelPiMock).toHaveBeenCalledWith("pi_test", expect.any(String));
  });
});
```

- [ ] **Step 2: Run the tests — confirm they all fail**

```bash
pnpm test:run __tests__/orders.test.ts
```

Expected: FAIL (route doesn't exist yet).

- [ ] **Step 3: Create `app/api/orders/route.ts`**

```typescript
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, dbPool } from "@/db";
import {
  authUser,
  cookProfiles,
  dishes,
  listingDishes,
  listingPromotions,
  listings,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  cancelPaymentIntent,
  createFullPaymentIntent,
  createSplitPaymentIntents,
} from "@/lib/stripe-payments";
import { getOrCreateStripeCustomer } from "@/lib/stripe-subscriptions";

const createOrderSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.number().int().min(1),
  paymentMethodId: z.string().min(1),
  pickupAt: z.string().datetime(),
  promotionId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { listingId, quantity, paymentMethodId, pickupAt, promotionId, notes } =
    parsed.data;

  try {
    const [listing] = await db
      .select({
        id: listings.id,
        cookId: listings.cookId,
        type: listings.type,
        status: listings.status,
        basePrice: listings.basePrice,
        minOrderQty: listings.minOrderQty,
        maxOrderQty: listings.maxOrderQty,
        depositEnabled: listings.depositEnabled,
        depositType: listings.depositType,
        depositValue: listings.depositValue,
      })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.status, "active")))
      .limit(1);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    if (listing.type !== "one_time") {
      return NextResponse.json(
        { error: "This listing is subscription-only." },
        { status: 400 },
      );
    }
    if (quantity < listing.minOrderQty) {
      return NextResponse.json(
        { error: `Minimum order quantity is ${listing.minOrderQty}.` },
        { status: 400 },
      );
    }
    if (listing.maxOrderQty !== null && quantity > listing.maxOrderQty) {
      return NextResponse.json(
        { error: `Maximum order quantity is ${listing.maxOrderQty}.` },
        { status: 400 },
      );
    }

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
        { error: "Cook payment account not connected." },
        { status: 400 },
      );
    }

    // Promotion
    let discountAmount = 0;
    let validatedPromotionId: string | null = null;
    if (promotionId) {
      const [promo] = await db
        .select({
          id: listingPromotions.id,
          type: listingPromotions.type,
          value: listingPromotions.value,
          maxUses: listingPromotions.maxUses,
          usesCount: listingPromotions.usesCount,
          validFrom: listingPromotions.validFrom,
          validUntil: listingPromotions.validUntil,
        })
        .from(listingPromotions)
        .where(
          and(
            eq(listingPromotions.id, promotionId),
            eq(listingPromotions.listingId, listingId),
            eq(listingPromotions.isActive, true),
          ),
        )
        .limit(1);

      if (!promo) {
        return NextResponse.json(
          { error: "Promotion not found or inactive." },
          { status: 400 },
        );
      }
      const now = new Date();
      if (promo.validFrom && new Date(promo.validFrom) > now) {
        return NextResponse.json({ error: "Promotion not yet active." }, { status: 400 });
      }
      if (promo.validUntil && new Date(promo.validUntil) <= now) {
        return NextResponse.json({ error: "Promotion has expired." }, { status: 400 });
      }
      if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
        return NextResponse.json(
          { error: "Promotion usage limit reached." },
          { status: 400 },
        );
      }
      const unitPriceForPromo = parseFloat(listing.basePrice);
      if (promo.type === "percentage_off") {
        discountAmount = Math.min(
          (unitPriceForPromo * quantity * parseFloat(promo.value)) / 100,
          unitPriceForPromo * quantity,
        );
      } else if (promo.type === "fixed_off") {
        discountAmount = Math.min(
          parseFloat(promo.value),
          unitPriceForPromo * quantity,
        );
      }
      validatedPromotionId = promo.id;
    }

    // Compute totals
    const unitPrice = parseFloat(listing.basePrice);
    const totalPrice = Math.max(0, unitPrice * quantity - discountAmount);
    const totalPriceCents = Math.round(totalPrice * 100);
    const platformFeePct = parseFloat(cook.platformFeePct);
    const totalPlatformFeeCents = Math.round(
      (totalPriceCents * platformFeePct) / 100,
    );
    const cookPayoutCents = totalPriceCents - totalPlatformFeeCents;

    // Deposit
    let depositAmountCents = 0;
    let depositAmount = 0;
    if (listing.depositEnabled && listing.depositValue) {
      const depositVal = parseFloat(listing.depositValue);
      depositAmount =
        listing.depositType === "percentage"
          ? Math.min((totalPrice * depositVal) / 100, totalPrice)
          : Math.min(depositVal, totalPrice);
      depositAmountCents = Math.round(depositAmount * 100);
    }

    // Stripe customer
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

    // Pre-generate order ID for idempotency keys
    const orderId = crypto.randomUUID();

    // Create Stripe PI(s)
    let fullPiId: string | null = null;
    let depositPiId: string | null = null;
    let balancePiId: string | null = null;

    if (depositAmountCents === 0) {
      const result = await createFullPaymentIntent({
        totalAmountCents: totalPriceCents,
        platformFeeCents: totalPlatformFeeCents,
        stripeCustomerId,
        paymentMethodId,
        connectedAccountId: cook.stripeAccountId,
        idempotencyKey: `full-${orderId}`,
      });
      fullPiId = result.piId;
    } else {
      const balanceAmountCents = totalPriceCents - depositAmountCents;
      const depositPlatformFeeCents = Math.round(
        (totalPlatformFeeCents * depositAmountCents) / totalPriceCents,
      );
      const balancePlatformFeeCents =
        totalPlatformFeeCents - depositPlatformFeeCents;
      const result = await createSplitPaymentIntents({
        depositAmountCents,
        balanceAmountCents,
        depositPlatformFeeCents,
        balancePlatformFeeCents,
        stripeCustomerId,
        paymentMethodId,
        connectedAccountId: cook.stripeAccountId,
        orderId,
      });
      depositPiId = result.deposit.piId;
      balancePiId = result.balance.piId;
    }

    // DB transaction
    try {
      await dbPool.transaction(async (tx) => {
        await tx.insert(orders).values({
          id: orderId as `${string}-${string}-${string}-${string}-${string}`,
          clientId: session.user.id,
          listingId,
          cookId: listing.cookId,
          status: "pending",
          quantity,
          unitPrice: String(unitPrice),
          promotionId: validatedPromotionId,
          discountAmount:
            discountAmount > 0
              ? String(discountAmount.toFixed(2))
              : null,
          totalPrice: String(totalPrice.toFixed(2)),
          currency: "CAD",
          pickupAt: new Date(pickupAt),
          notes: notes ?? null,
          depositEnabled: listing.depositEnabled,
          depositType: listing.depositType ?? null,
          depositValue: listing.depositValue ?? null,
          depositAmount:
            depositAmount > 0 ? String(depositAmount.toFixed(2)) : null,
        });

        const listingDishRows = await tx
          .select({
            dishId: listingDishes.dishId,
            quantity: listingDishes.quantity,
            sortOrder: listingDishes.sortOrder,
            dishName: dishes.name,
          })
          .from(listingDishes)
          .innerJoin(dishes, eq(listingDishes.dishId, dishes.id))
          .where(eq(listingDishes.listingId, listingId));

        if (listingDishRows.length > 0) {
          await tx.insert(orderDishes).values(
            listingDishRows.map((d) => ({
              orderId,
              dishId: d.dishId,
              dishName: d.dishName,
              quantity: d.quantity,
              sortOrder: d.sortOrder,
            })),
          );
        }

        if (fullPiId) {
          await tx.insert(orderPayments).values({
            orderId,
            cookId: listing.cookId,
            clientId: session.user.id,
            type: "full",
            status: "authorized",
            totalAmount: String(totalPrice.toFixed(2)),
            platformFeePct: cook.platformFeePct,
            platformFeeAmount: String(
              (totalPlatformFeeCents / 100).toFixed(2),
            ),
            cookPayoutAmount: String((cookPayoutCents / 100).toFixed(2)),
            currency: "CAD",
            stripePaymentIntentId: fullPiId,
            authorizedAt: new Date(),
          });
        }

        if (depositPiId && balancePiId) {
          const depPlatFee = Math.round(
            (totalPlatformFeeCents * depositAmountCents) / totalPriceCents,
          );
          const balPlatFee = totalPlatformFeeCents - depPlatFee;
          const balAmtCents = totalPriceCents - depositAmountCents;

          await tx.insert(orderPayments).values([
            {
              orderId,
              cookId: listing.cookId,
              clientId: session.user.id,
              type: "deposit",
              status: "authorized",
              totalAmount: String((depositAmountCents / 100).toFixed(2)),
              platformFeePct: cook.platformFeePct,
              platformFeeAmount: String((depPlatFee / 100).toFixed(2)),
              cookPayoutAmount: String(
                ((depositAmountCents - depPlatFee) / 100).toFixed(2),
              ),
              currency: "CAD",
              stripePaymentIntentId: depositPiId,
              authorizedAt: new Date(),
            },
            {
              orderId,
              cookId: listing.cookId,
              clientId: session.user.id,
              type: "balance",
              status: "authorized",
              totalAmount: String((balAmtCents / 100).toFixed(2)),
              platformFeePct: cook.platformFeePct,
              platformFeeAmount: String((balPlatFee / 100).toFixed(2)),
              cookPayoutAmount: String(
                ((balAmtCents - balPlatFee) / 100).toFixed(2),
              ),
              currency: "CAD",
              stripePaymentIntentId: balancePiId,
              authorizedAt: new Date(),
            },
          ]);
        }
      });
    } catch (dbErr) {
      const cancels = [fullPiId, depositPiId, balancePiId]
        .filter((id): id is string => id !== null)
        .map((id) =>
          cancelPaymentIntent(id, `cancel-${orderId}-${id}`).catch(() => {}),
        );
      await Promise.allSettled(cancels);
      throw dbErr;
    }

    return NextResponse.json(
      { success: true, data: { orderId } },
      { status: 201 },
    );
  } catch (err) {
    console.error("[orders/POST]", err);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test:run __tests__/orders.test.ts
```

Expected: all pass.

- [ ] **Step 5: Type-check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/api/orders/route.ts __tests__/orders.test.ts
git commit -m "feat: POST /api/orders — one-time order placement with Stripe escrow"
```

---

## Task 13: Fix Subscription Webhook — `held` Status + Store `stripeChargeId`

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Update the `invoice.payment_succeeded` handler**

In the `switch` block, find the `case "invoice.payment_succeeded":` handler. Replace the `orderPayments` insert values block with:

```typescript
// Retrieve charge ID from the PI so we can store it for dispute/refund webhooks
let stripeChargeId: string | null = null;
if (paymentIntentId) {
  try {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const latestCharge = pi.latest_charge;
    if (latestCharge && typeof latestCharge === "object") {
      stripeChargeId = latestCharge.id;
    }
  } catch {
    // non-fatal — chargeId is best-effort
  }
}

await db.insert(orderPayments).values({
  orderId: order.id,
  cookId: sub.cookId,
  clientId: sub.clientId,
  type: "full",
  status: "held",          // captured on platform, awaiting manual transfer at pickup
  totalAmount: totalPrice,
  platformFeePct: cook.platformFeePct,
  platformFeeAmount,
  cookPayoutAmount,
  currency: "CAD",
  stripePaymentIntentId: paymentIntentId,
  stripeChargeId,
  authorizedAt: new Date(),
  heldAt: new Date(),
});
```

Also add `import { getStripe } from "@/lib/stripe";` at the top of the file (replace the local `function getStripe()` definition in the webhook file with the import).

- [ ] **Step 2: Run tests**

```bash
pnpm test:run
```

Expected: all pass (the webhook test mocks `orderPayments`, so the `type`/`status` change is transparent).

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "fix: subscription invoice payments use held status and store chargeId"
```

---

## Task 14: Fix Subscription Creation — Remove `transfer_data`

**Files:**
- Modify: `app/api/subscriptions/route.ts`

- [ ] **Step 1: Remove `transfer_data` from the `createStripeSubscription` call**

In `app/api/subscriptions/route.ts`, the call to `createStripeSubscription` passes `connectedAccountId`. That param is now used for `on_behalf_of` in the updated lib (Task 7, Step 3) — no change needed in the call site.

Verify the call still compiles:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Commit**

```bash
git add app/api/subscriptions/route.ts
git commit -m "fix: subscription creation no longer auto-transfers to cook (platform holds for escrow)"
```

---

## Task 15: Update `verify-code` — Handle All Payment Variants

**Files:**
- Modify: `app/api/business/dashboard/orders/[orderId]/verify-code/route.ts`

- [ ] **Step 1: Replace the payment-release block**

Find the existing payment capture block (starting at `const stripeKey = process.env.STRIPE_SECRET_KEY`) and replace it entirely:

```typescript
// Release payment to cook based on payment type
const payments = await db
  .select({
    id: orderPayments.id,
    type: orderPayments.type,
    status: orderPayments.status,
    stripePaymentIntentId: orderPayments.stripePaymentIntentId,
    cookPayoutAmount: orderPayments.cookPayoutAmount,
  })
  .from(orderPayments)
  .where(eq(orderPayments.orderId, orderId));

// Load cook's stripeAccountId for subscription transfer
const [cookRow] = await db
  .select({ stripeAccountId: cookProfiles.stripeAccountId })
  .from(cookProfiles)
  .where(eq(cookProfiles.id, cookId))
  .limit(1);

for (const payment of payments) {
  if (payment.type === "deposit") continue; // deposit released at confirmation — skip

  if (!payment.stripePaymentIntentId) continue;

  if (payment.status === "authorized") {
    // One-time PI (full or balance) — capture and auto-transfer via transfer_data
    await capturePaymentIntent(
      payment.stripePaymentIntentId,
      `capture-${orderId}-${payment.type}`,
    );
    await db
      .update(orderPayments)
      .set({ status: "released", releasedAt: fulfilledAt })
      .where(
        and(
          eq(orderPayments.id, payment.id),
          eq(orderPayments.status, "authorized"),
        ),
      );
  } else if (payment.status === "held") {
    // Subscription payment: funds captured on platform, manually transfer cook's share
    if (payment.cookPayoutAmount && cookRow?.stripeAccountId) {
      const payoutCents = Math.round(
        parseFloat(payment.cookPayoutAmount) * 100,
      );
      const transferId = await createSubscriptionTransfer({
        amountCents: payoutCents,
        connectedAccountId: cookRow.stripeAccountId,
        idempotencyKey: `transfer-${orderId}`,
      });
      await db
        .update(orderPayments)
        .set({
          status: "released",
          stripeTransferId: transferId,
          releasedAt: fulfilledAt,
        })
        .where(
          and(
            eq(orderPayments.id, payment.id),
            eq(orderPayments.status, "held"),
          ),
        );
    }
  }
}
```

Add imports at top of file:

```typescript
import { and, eq } from "drizzle-orm";
import { cookProfiles, orderPayments } from "@/db/schema";
import {
  capturePaymentIntent,
  createSubscriptionTransfer,
} from "@/lib/stripe-payments";
```

Remove the existing `import Stripe from "stripe";` and the manual Stripe instantiation since we now use the helpers.

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Run tests**

```bash
pnpm test:run
```

- [ ] **Step 4: Commit**

```bash
git add app/api/business/dashboard/orders/[orderId]/verify-code/route.ts
git commit -m "feat: verify-code releases payment for all variants — full, balance, subscription held"
```

---

## Task 16: Deposit Release on Cook Confirmation + Cook Cancel Logic

**Files:**
- Modify: `app/api/business/dashboard/orders/[orderId]/status/route.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles, orderPayments, orders } from "@/db/schema";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  partialCapturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe-payments";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.uuid();

const bodySchema = z.object({
  status: z.enum(["confirmed", "ready", "cancelled"]),
  reason: z.enum(["client_no_show"]).optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["confirmed", "cancelled"],
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { status: newStatus, reason } = parsed.data;

  try {
    const [order] = await db
      .select({
        id: orders.id,
        cookId: orders.cookId,
        status: orders.status,
        totalPrice: orders.totalPrice,
        pickupAt: orders.pickupAt,
        lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
        lateCancelFeeType: orders.lateCancelFeeType,
        lateCancelFeeValue: orders.lateCancelFeeValue,
        lateCancelWindowHours: orders.lateCancelWindowHours,
        depositAmount: orders.depositAmount,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const allowedTransitions = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        { error: "Invalid status transition." },
        { status: 400 },
      );
    }

    // On confirmation: release the deposit PI to the cook
    if (newStatus === "confirmed") {
      const [depositPayment] = await db
        .select({
          id: orderPayments.id,
          stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        })
        .from(orderPayments)
        .where(
          and(
            eq(orderPayments.orderId, orderId),
            eq(orderPayments.type, "deposit"),
            eq(orderPayments.status, "authorized"),
          ),
        )
        .limit(1);

      if (depositPayment?.stripePaymentIntentId) {
        await capturePaymentIntent(
          depositPayment.stripePaymentIntentId,
          `deposit-release-${orderId}`,
        );
        await db
          .update(orderPayments)
          .set({ status: "released", releasedAt: new Date() })
          .where(eq(orderPayments.id, depositPayment.id));
      }
    }

    // On cancellation: handle payment based on who cancels and why
    if (newStatus === "cancelled") {
      const allPayments = await db
        .select({
          id: orderPayments.id,
          type: orderPayments.type,
          status: orderPayments.status,
          totalAmount: orderPayments.totalAmount,
          stripePaymentIntentId: orderPayments.stripePaymentIntentId,
          cookPayoutAmount: orderPayments.cookPayoutAmount,
          platformFeePct: orderPayments.platformFeePct,
        })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, orderId));

      const isClientNoShow = reason === "client_no_show";

      for (const payment of allPayments) {
        if (!payment.stripePaymentIntentId) continue;

        if (isClientNoShow) {
          // Client no-show: cook gets everything
          if (payment.status === "authorized") {
            await capturePaymentIntent(
              payment.stripePaymentIntentId,
              `noshow-capture-${orderId}-${payment.type}`,
            );
            await db
              .update(orderPayments)
              .set({ status: "released", releasedAt: new Date() })
              .where(eq(orderPayments.id, payment.id));
          }
          // deposit row is already released at confirmation — skip
          continue;
        }

        // Cook cancels voluntarily
        if (payment.status === "authorized") {
          // deposit row before confirmation: cancel PI (full refund to client)
          await cancelPaymentIntent(
            payment.stripePaymentIntentId,
            `cook-cancel-${orderId}-${payment.type}`,
          );
          await db
            .update(orderPayments)
            .set({ status: "refunded", refundedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        } else if (payment.status === "released" && payment.type === "deposit") {
          // Deposit was already captured+transferred to cook; reverse it
          const refundId = await refundPaymentIntent({
            paymentIntentId: payment.stripePaymentIntentId,
            reverseTransfer: true,
            idempotencyKey: `cook-cancel-deposit-refund-${orderId}`,
          });
          await db
            .update(orderPayments)
            .set({ status: "refunded", stripeRefundId: refundId, refundedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        }
      }
    }

    const updateFields: Partial<typeof orders.$inferInsert> = { status: newStatus };
    if (newStatus === "cancelled") {
      updateFields.cancelledAt = new Date();
      updateFields.cancelledBy = (
        await db
          .select({ userId: cookProfiles.userId })
          .from(cookProfiles)
          .where(eq(cookProfiles.id, cookId))
          .limit(1)
      )[0]?.userId;
    }

    const [updated] = await db
      .update(orders)
      .set(updateFields)
      .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[dashboard/orders/status]", err);
    return NextResponse.json(
      { error: "Failed to update order status." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Run tests**

```bash
pnpm test:run
```

- [ ] **Step 4: Commit**

```bash
git add app/api/business/dashboard/orders/[orderId]/status/route.ts
git commit -m "feat: deposit release on confirm; cook cancel/no-show payment logic"
```

---

## Task 17: Client Order Cancellation Route

**Files:**
- Create: `app/api/orders/[orderId]/route.ts`
- Create: `__tests__/orders-cancel.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/orders-cancel.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orderPayments: {},
  orders: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

const cancelPiMock = vi.fn();
const refundPiMock = vi.fn().mockResolvedValue("re_test");
const partialCaptureMock = vi.fn();
vi.mock("@/lib/stripe-payments", () => ({
  cancelPaymentIntent: cancelPiMock,
  refundPaymentIntent: refundPiMock,
  partialCapturePaymentIntent: partialCaptureMock,
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/orders/[orderId]/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(orderId: string) {
  return new NextRequest(`http://localhost/api/orders/${orderId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
  });
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function updateChain() {
  const where = vi.fn().mockResolvedValue([{}]);
  const set = vi.fn(() => ({ where }));
  return { set } as never;
}

const ORDER_ID = "00000000-0000-0000-0000-000000000099";

const PENDING_ORDER = {
  id: ORDER_ID,
  clientId: "user-1",
  status: "pending",
  totalPrice: "20.00",
  pickupAt: new Date(Date.now() + 86400000),
  lateCancelFeeEnabled: false,
  lateCancelFeeType: null,
  lateCancelFeeValue: null,
  lateCancelWindowHours: 24,
  depositAmount: null,
};

const CONFIRMED_ORDER = {
  ...PENDING_ORDER,
  status: "confirmed",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", role: "client", email: "c@t.com" },
  } as never);
  vi.mocked(db.update).mockReturnValue(updateChain());
});

afterEach(() => vi.unstubAllEnvs());

describe("DELETE /api/orders/[orderId]", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when order not found", async () => {
    vi.mocked(db.select).mockImplementation(() => limitChain([]));
    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("cancels PI and returns 200 for a pending order", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([PENDING_ORDER]);
      return limitChain([
        { id: "pay-1", type: "full", status: "authorized", stripePaymentIntentId: "pi_1", totalAmount: "20.00", platformFeePct: "7.50" },
      ]);
    });

    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(200);
    expect(cancelPiMock).toHaveBeenCalledWith("pi_1", expect.any(String));
  });

  it("returns 400 for a fulfilled order", async () => {
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ ...PENDING_ORDER, status: "fulfilled" }]),
    );
    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("partially captures late cancel fee on balance PI when within window", async () => {
    const pickupSoon = new Date(Date.now() + 2 * 3600 * 1000); // 2 hours from now
    const orderWithFee = {
      ...CONFIRMED_ORDER,
      pickupAt: pickupSoon,
      lateCancelFeeEnabled: true,
      lateCancelFeeType: "flat",
      lateCancelFeeValue: "5.00",
      lateCancelWindowHours: 24,
      depositAmount: null,
    };
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return limitChain([orderWithFee]);
      return limitChain([
        { id: "pay-1", type: "full", status: "authorized", stripePaymentIntentId: "pi_1", totalAmount: "20.00", platformFeePct: "7.50" },
      ]);
    });

    const res = await DELETE(makeRequest(ORDER_ID), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });
    expect(res.status).toBe(200);
    expect(partialCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({ captureAmountCents: 500 }),
    );
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm test:run __tests__/orders-cancel.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create `app/api/orders/[orderId]/route.ts`**

```typescript
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orderPayments, orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  partialCapturePaymentIntent,
  refundPaymentIntent,
} from "@/lib/stripe-payments";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.uuid();

const CANCELLABLE_STATUSES = ["pending", "confirmed"];

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const [order] = await db
      .select({
        id: orders.id,
        clientId: orders.clientId,
        status: orders.status,
        totalPrice: orders.totalPrice,
        pickupAt: orders.pickupAt,
        lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
        lateCancelFeeType: orders.lateCancelFeeType,
        lateCancelFeeValue: orders.lateCancelFeeValue,
        lateCancelWindowHours: orders.lateCancelWindowHours,
        depositAmount: orders.depositAmount,
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.clientId, session.user.id),
        ),
      )
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: "Order cannot be cancelled at this stage." },
        { status: 400 },
      );
    }

    const allPayments = await db
      .select({
        id: orderPayments.id,
        type: orderPayments.type,
        status: orderPayments.status,
        totalAmount: orderPayments.totalAmount,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        platformFeePct: orderPayments.platformFeePct,
      })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, orderId));

    // Compute capture floor
    const now = new Date();
    const pickupAt = new Date(order.pickupAt);
    const windowMs =
      (order.lateCancelWindowHours ?? 24) * 60 * 60 * 1000;
    const withinWindow = now > new Date(pickupAt.getTime() - windowMs);

    const totalPrice = parseFloat(order.totalPrice);
    const depositAmount = order.depositAmount
      ? parseFloat(order.depositAmount)
      : 0;

    let lateCancelFee = 0;
    if (order.lateCancelFeeEnabled && withinWindow && order.lateCancelFeeValue) {
      const feeVal = parseFloat(order.lateCancelFeeValue);
      lateCancelFee =
        order.lateCancelFeeType === "flat"
          ? Math.min(feeVal, totalPrice)
          : Math.min((totalPrice * feeVal) / 100, totalPrice);
    }

    // If deposit already covers protection, no additional capture on balance
    const totalCaptureFloor = Math.max(depositAmount, lateCancelFee);
    // For the active (non-deposit) PI: capture max(0, totalCaptureFloor - depositAmount)
    const additionalCapture = Math.max(0, totalCaptureFloor - depositAmount);
    const additionalCaptureCents = Math.round(additionalCapture * 100);

    for (const payment of allPayments) {
      if (!payment.stripePaymentIntentId) continue;

      if (payment.type === "deposit" && payment.status === "released") {
        // Deposit already with cook — stays there regardless (non-refundable after confirmation)
        continue;
      }

      if (payment.type === "deposit" && payment.status === "authorized") {
        // Deposit not yet captured (order still pending) — cancel/refund to client
        await cancelPaymentIntent(
          payment.stripePaymentIntentId,
          `client-cancel-deposit-${orderId}`,
        );
        await db
          .update(orderPayments)
          .set({ status: "refunded", refundedAt: new Date() })
          .where(eq(orderPayments.id, payment.id));
        continue;
      }

      // full or balance PI
      if (payment.status === "authorized") {
        const paymentTotalCents = Math.round(
          parseFloat(payment.totalAmount) * 100,
        );

        if (additionalCaptureCents > 0 && additionalCaptureCents < paymentTotalCents) {
          // Partial capture for late cancel fee
          const platformFeePct = parseFloat(payment.platformFeePct ?? "0");
          const newFeeCents = Math.round(
            (additionalCaptureCents * platformFeePct) / 100,
          );
          await partialCapturePaymentIntent({
            piId: payment.stripePaymentIntentId,
            captureAmountCents: additionalCaptureCents,
            newPlatformFeeCents: newFeeCents,
            idempotencyKey: `client-cancel-partial-${orderId}`,
          });
          await db
            .update(orderPayments)
            .set({
              status: "released",
              releasedAt: new Date(),
            })
            .where(eq(orderPayments.id, payment.id));
        } else if (additionalCaptureCents >= paymentTotalCents) {
          // Cook keeps full balance payment
          await capturePaymentIntent(
            payment.stripePaymentIntentId,
            `client-cancel-full-capture-${orderId}`,
          );
          await db
            .update(orderPayments)
            .set({ status: "released", releasedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        } else {
          // Full refund to client
          await cancelPaymentIntent(
            payment.stripePaymentIntentId,
            `client-cancel-${orderId}-${payment.type}`,
          );
          await db
            .update(orderPayments)
            .set({ status: "refunded", refundedAt: new Date() })
            .where(eq(orderPayments.id, payment.id));
        }
      } else if (payment.status === "held") {
        // Subscription payment — refund
        const refundId = await refundPaymentIntent({
          paymentIntentId: payment.stripePaymentIntentId,
          idempotencyKey: `client-cancel-refund-${orderId}`,
        });
        await db
          .update(orderPayments)
          .set({ status: "refunded", stripeRefundId: refundId, refundedAt: new Date() })
          .where(eq(orderPayments.id, payment.id));
      }
    }

    await db
      .update(orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: session.user.id,
        ...(lateCancelFee > 0
          ? { lateCancelFeeApplied: String(lateCancelFee.toFixed(2)) }
          : {}),
      })
      .where(and(eq(orders.id, orderId), eq(orders.clientId, session.user.id)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[orders/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to cancel order." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test:run __tests__/orders-cancel.test.ts
```

Expected: all pass.

- [ ] **Step 5: Type-check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/api/orders/[orderId]/route.ts __tests__/orders-cancel.test.ts
git commit -m "feat: DELETE /api/orders/[orderId] — client cancel with late-cancel-fee and deposit logic"
```

---

## Task 18: New Webhook Handlers — `payment_intent.payment_failed`, `charge.dispute.created`, `charge.refunded`

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Add three new cases to the switch statement**

Inside the `switch (event.type)` block, add before the `default:` case:

```typescript
case "payment_intent.payment_failed": {
  const pi = event.data.object as Stripe.PaymentIntent;
  await db
    .update(orderPayments)
    .set({ status: "pending" })
    .where(eq(orderPayments.stripePaymentIntentId, pi.id));
  break;
}

case "charge.dispute.created": {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
  await db
    .update(orderPayments)
    .set({ status: "disputed" })
    .where(eq(orderPayments.stripeChargeId, chargeId));
  break;
}

case "charge.refunded": {
  const charge = event.data.object as Stripe.Charge;
  await db
    .update(orderPayments)
    .set({ status: "refunded", refundedAt: new Date() })
    .where(eq(orderPayments.stripeChargeId, charge.id));
  break;
}
```

- [ ] **Step 2: Write tests for the three new handlers**

Add a new describe block to `__tests__/webhooks-stripe.test.ts`:

```typescript
describe("one-time payment event handlers", () => {
  it("payment_intent.payment_failed sets status to pending", async () => {
    const res = await POST(
      makeRequest({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_1" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("charge.dispute.created sets status to disputed", async () => {
    const res = await POST(
      makeRequest({
        type: "charge.dispute.created",
        data: { object: { charge: "ch_1" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "disputed" }),
    );
  });

  it("charge.refunded sets status to refunded", async () => {
    const res = await POST(
      makeRequest({
        type: "charge.refunded",
        data: { object: { id: "ch_1" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "refunded" }),
    );
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test:run
```

Expected: all pass.

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Final lint**

```bash
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/stripe/route.ts __tests__/webhooks-stripe.test.ts
git commit -m "feat: webhook handlers for payment_intent.payment_failed, charge.dispute.created, charge.refunded"
```

---

## Task 19: End-to-End Smoke Test with Stripe CLI

This task has no code changes — it validates the full flow using real Stripe test credentials.

- [ ] **Step 1: Start the Stripe CLI listener in a terminal**

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Leave this running.

- [ ] **Step 2: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Create a test cook with a real Express Connect account**

Use a REST client (curl, Postman, or Bruno) to call:

```
POST /api/setup/stripe-connect
Authorization: <cook session cookie>
```

Then call:

```
POST /api/business/dashboard/stripe/onboarding-link
```

Open the returned URL in a browser and complete Express onboarding using Stripe's test data. Confirm `chargesEnabled: true` via:

```
GET /api/business/dashboard/stripe/status
```

- [ ] **Step 4: Create a subscription listing tier and subscribe a test client**

Create a subscription listing, add a tier via `POST /api/business/listings/:id/tiers`, then subscribe a client via `POST /api/subscriptions` passing `paymentMethodId: "pm_card_visa"` (Stripe test token). Confirm the Stripe CLI prints `invoice.payment_succeeded` and the `order_payments` row has `status = held`.

- [ ] **Step 5: Verify subscription pickup**

Call `POST /api/business/dashboard/orders/:id/verify-code` with the correct code. Confirm Stripe CLI shows the transfer being created and `order_payments.status` becomes `released`.

- [ ] **Step 6: Create a one-time order with a test card**

```
POST /api/orders
{
  "listingId": "<active one_time listing>",
  "quantity": 1,
  "paymentMethodId": "pm_card_visa",
  "pickupAt": "<tomorrow ISO>"
}
```

Confirm PI is created in test mode in the Stripe Dashboard.

- [ ] **Step 7: Test a cancellation**

Cancel the order via `DELETE /api/orders/:id`. Confirm PI is cancelled in Stripe Dashboard and `order_payments.status = refunded`.
