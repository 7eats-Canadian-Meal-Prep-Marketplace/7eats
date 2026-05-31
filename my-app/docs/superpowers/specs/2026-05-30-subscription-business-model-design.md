# Subscription Business Model Design

**Date:** 2026-05-30  
**Branch:** business-dashboard  
**Status:** Approved

---

## Overview

Cooks can configure each listing as either a **one-time purchase** or a **subscription**. Subscription listings use a multi-tier interval system — a cook can offer up to three cadences (weekly, bi-weekly, monthly) each with its own price on the same listing. Every subscription cycle auto-generates a real `orders` row that flows through the full pickup-code escrow lifecycle, indistinguishable from a one-time order in the cook's dashboard.

---

## Core Decisions

- A listing is strictly one type: `one_time` OR `subscription`. No mixed mode on a single listing.
- Subscription listings use **multi-tier pricing** (Uber Eats style): one listing, multiple interval options, client picks at checkout.
- Every billing cycle creates a new `orders` row — same escrow, same pickup code, same payout flow as one-time orders.
- Subscription payments use `capture_method: manual` so authorization is held until pickup code is verified — no cook gets paid before the client receives their food.

---

## Data Model

### New enums

```sql
CREATE TYPE subscription_interval AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled', 'past_due');
```

**Stripe interval mapping:**
| Our interval | Stripe `interval` | Stripe `interval_count` |
|---|---|---|
| `weekly` | `week` | `1` |
| `biweekly` | `week` | `2` |
| `monthly` | `month` | `1` |

### New table: `listing_subscription_tiers`

One row per interval option a cook offers on a subscription listing.

```sql
CREATE TABLE listing_subscription_tiers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  interval          subscription_interval NOT NULL,
  price             numeric(10, 2) NOT NULL,
  stripe_price_id   text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tier_price_positive CHECK (price > 0),
  CONSTRAINT listing_interval_unique UNIQUE (listing_id, interval)
);
ALTER TABLE listing_subscription_tiers ENABLE ROW LEVEL SECURITY;
```

RLS policies: cook can select/insert/update/delete own tiers; public can select tiers for active listings.

### New table: `client_subscriptions`

One row per client-listing-tier subscription. Source of truth for "who is subscribed to what."

```sql
CREATE TABLE client_subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  listing_id               uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  tier_id                  uuid NOT NULL REFERENCES listing_subscription_tiers(id) ON DELETE RESTRICT,
  cook_id                  uuid NOT NULL REFERENCES cook_profiles(id) ON DELETE RESTRICT,
  status                   subscription_status NOT NULL DEFAULT 'active',
  stripe_subscription_id   text NOT NULL UNIQUE,
  stripe_customer_id       text NOT NULL,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  cancelled_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
);
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;
```

RLS policies: client can select/manage own subscriptions; cook can select subscriptions for their listings; service_role can insert/update.

### Modified: `user` table

```sql
ALTER TABLE "user" ADD COLUMN stripe_customer_id text;
```

One Stripe Customer per platform user, reused across all their subscriptions.

### Modified: `orders` table

```sql
ALTER TABLE orders ADD COLUMN subscription_id uuid REFERENCES client_subscriptions(id) ON DELETE SET NULL;
```

Links a recurring order back to its subscription. Null for one-time orders.

### Modified: `listings` table

```sql
ALTER TABLE listings ADD COLUMN stripe_product_id text;
```

`base_price` stays as-is. For subscription listings it serves as a "starting from" display price and is automatically set to the cheapest active tier price when tiers are saved. The actual charge always comes from the tier. `stripe_product_id` stores the Stripe Product created on the cook's connected account (one per subscription listing, shared across all its tiers).

---

## Stripe Architecture

### Cook setup (one-time per tier)

1. Cook creates a subscription listing and adds tiers
2. For each tier, backend calls Stripe:
   - Create a **Stripe Product** on the cook's connected account (once per listing, reused across tiers; store ID in listing metadata)
   - Create a **Stripe Price** on the connected account: `recurring.interval` mapped from tier interval, `unit_amount` from tier price
3. `stripe_price_id` stored on the tier row

### Client subscribes

1. Client picks tier → checkout
2. Backend ensures Stripe Customer exists for client on platform account; creates one if `user.stripe_customer_id` is null and stores it
3. Client attaches payment method via **SetupIntent** (Stripe Elements)
4. Backend creates **Stripe Subscription**:
   - `customer`: client's Stripe Customer ID
   - `items`: `[{ price: tier.stripe_price_id }]`
   - `application_fee_percent`: cook's `platform_fee_pct`
   - `transfer_data.destination`: cook's `stripe_account_id`
   - `payment_settings.payment_method_options.card.capture_method`: `'manual'` — holds authorization, does not capture immediately
5. Backend creates `client_subscriptions` row (status `active`)
6. Stripe fires `invoice.payment_succeeded` for the first invoice — the webhook creates the first `orders` row exactly like every subsequent cycle. No special first-order handling in the subscribe endpoint.

### Per-cycle billing (automatic)

```
Stripe fires invoice.payment_succeeded (authorized, not captured)
  → Webhook creates orders row (status: pending, subscription_id set)
  → Webhook creates order_payments row (status: authorized, stripe_payment_intent_id from invoice)
  → Cook sees new order in dashboard (identical to one-time order)
  → Order follows: pending → confirmed → ready → fulfilled
  → Cook marks ready → pickup code generated and sent to client
  → Client shows code → cook verifies → POST /verify-code
  → PaymentIntent captured → funds released to cook (existing transfer flow)
```

### Failure & cancellation webhooks

| Stripe event | Action |
|---|---|
| `invoice.payment_succeeded` | Create `orders` row + `order_payments` row (authorized) |
| `invoice.payment_failed` | Set `client_subscriptions.status = 'past_due'` |
| `customer.subscription.deleted` | Set `status = 'cancelled'`, set `cancelled_at` |
| `customer.subscription.updated` | Sync `cancel_at_period_end`, period dates, status |

---

## API Endpoints

### Cook-side — tier management

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/business/listings/[listingId]/tiers` | Create tier; creates Stripe Product (if first tier) + Stripe Price |
| `GET` | `/api/business/listings/[listingId]/tiers` | List all tiers for a listing |
| `PATCH` | `/api/business/listings/[listingId]/tiers/[tierId]` | Update price (creates new Stripe Price, archives old) or toggle `is_active` |
| `DELETE` | `/api/business/listings/[listingId]/tiers/[tierId]` | Deactivate tier; blocked if active subscribers exist on that tier |

### Client-side — subscriptions

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/subscriptions` | Subscribe to a listing tier; creates/reuses Stripe Customer, creates Stripe Subscription |
| `GET` | `/api/subscriptions` | List client's subscriptions with tier + listing info |
| `GET` | `/api/subscriptions/[subscriptionId]` | Single subscription detail + upcoming order date |
| `DELETE` | `/api/subscriptions/[subscriptionId]` | Cancel; `?immediate=true` for immediate, default is cancel at period end |

### Modified: existing endpoints

- `POST /api/business/listings` — when `type = 'subscription'`, `base_price` validation deferred until first tier is saved
- `POST /api/webhooks/stripe` — add 4 new invoice/subscription event handlers alongside existing payout handlers

### Unchanged

- `/api/business/dashboard/orders/[orderId]/verify-code` — captures PaymentIntent; works for both order types without modification
- All order status endpoints — subscription orders are identical once created
- All payout endpoints — same Stripe Connect flow

---

## Cancellation Behaviour

- **Graceful (default):** `cancel_at_period_end = true` — subscription active until current period ends, then stops. No surprise charge. In-progress orders for current cycle complete normally.
- **Immediate:** Stripe subscription cancelled now. Any order already created for current cycle continues its escrow lifecycle unaffected (client already authorized payment).
- Cook dashboard shows a "subscription cancelled" indicator so they know not to expect future orders from that client on that listing.

---

## What Does Not Change

- One-time order checkout flow — completely untouched
- Pickup code generation and verification
- Payment escrow hold/release logic
- Cook payout flow and Stripe Connect setup
- RLS patterns — new tables follow the same policies as existing tables

---

## Out of Scope

- Subscription pausing (status exists in schema for future use but no UI/API in this iteration)
- Client switching tiers mid-subscription (cancel + re-subscribe)
- Proration handling
- Free trial periods
