# Stripe Integration Design — 7eats

**Date:** 2026-06-02  
**Status:** Approved

---

## 1. Charge Architecture

**Model:** Destination charges on the 7eats platform account.

- All charges flow through the platform Stripe account (`acct_1Tdje43I1sDQk1qG`)
- Products and prices live on the **platform account** (fix: remove `stripeAccount` param from `getOrCreateStripeProduct` and `createStripePrice` in `lib/stripe-subscriptions.ts`)
- Stripe Customers live on the platform account (`user.stripe_customer_id` already in schema)
- Every charge uses `transfer_data: { destination: cook.stripeAccountId }` + `application_fee_amount` (one-time) or `application_fee_percent` (subscriptions)
- Single webhook endpoint on the platform handles all events, including Connect events

---

## 2. Cook Stripe Connect Onboarding (Express)

### What changes
Replace the 501 stub in `POST /api/setup/stripe-connect` with real logic.

### Flow
1. If cook already has a `stripeAccountId` → skip creation, return success
2. Call `stripe.accounts.create({ type: 'express', country: 'CA', capabilities: { card_payments: { requested: true }, transfers: { requested: true } } })`
3. Store `account.id` on `cook_profiles.stripe_account_id`
4. Return `{ success: true }`
5. Frontend then calls `POST /api/business/dashboard/stripe/onboarding-link` (already implemented) to redirect cook to Stripe Express onboarding

Dev mode: keep existing mock guard (`mock_acct_` prefix) — no change.

### Routes that already work (no changes needed)
- `GET /api/business/dashboard/stripe/status` — retrieves `charges_enabled`, `payouts_enabled`
- `POST /api/business/dashboard/stripe/onboarding-link` — creates `accountLinks` URL
- `POST /api/business/dashboard/stripe/dashboard-link` — creates `loginLink` URL

---

## 3. Schema Changes

### 3a. `enums.ts` — add payment type
```typescript
paymentTypeEnum: 'deposit' | 'balance' | 'full'
```

### 3b. `listings` table — deposit settings
```
depositEnabled    boolean   not null  default false
depositType       enum('flat','percentage')   nullable
depositValue      numeric(10,2)               nullable
```

Constraints: `depositValue > 0` when `depositEnabled = true`.

### 3c. `orders` table — deposit snapshot
```
depositEnabled    boolean   not null  default false
depositType       enum('flat','percentage')   nullable
depositValue      numeric(10,2)               nullable
depositAmount     numeric(10,2)               nullable  -- computed dollars at order time
```

### 3d. `order_payments` table — multi-row support + type field
- **Drop** the `UNIQUE` constraint on `order_id`
- **Add** `type  paymentTypeEnum  not null  default 'full'`
- Add composite unique index on `(order_id, type)` to prevent duplicate rows of the same type

`type` meanings:
- `'full'` — single PI covering the entire order (no deposit)
- `'deposit'` — the upfront deposit PI (captured immediately, transferred on cook confirmation)
- `'balance'` — the remaining balance PI (manual capture, transferred at pickup)

---

## 4. One-Time Order Placement (`POST /api/orders`)

### Request body
```typescript
{
  listingId: string       // uuid
  quantity: number        // >= 1
  paymentMethodId: string // pm_...
  pickupAt: string        // ISO datetime
  promotionId?: string    // uuid
  notes?: string
}
```

### Server logic
1. Auth: client session, role = `client`
2. Validate: listing `active` + `one_time`, cook has `stripeAccountId`, quantity within `[minOrderQty, maxOrderQty]`
3. Apply promotion if `promotionId` — compute `discountAmount`, `totalPrice`
4. Snapshot deposit settings from listing: compute `depositAmount` (flat or `totalPrice × depositValue/100`)
5. Get/create Stripe Customer — cache to `user.stripeCustomerId`
6. Compute `platformFeeAmount = totalPrice × platformFeePct / 100`

#### No-deposit path (single PI)
- Create PI: `amount = totalPriceCents`, `capture_method: 'manual'`, `confirm: true`, `payment_method`, `transfer_data`, `application_fee_amount = platformFeeCents`
- DB transaction: insert `orders`, insert `order_dishes` snapshot, insert `order_payments` (type `'full'`, status `'authorized'`)

#### Deposit path (two PIs)
Both PIs use `capture_method: 'manual'` and `transfer_data`. The deposit is NOT transferred until the cook confirms — Stripe holds it in authorized state, the cook cannot access it until capture.

- Create **Deposit PI**: `amount = depositAmountCents`, `capture_method: 'manual'`, `confirm: true`, `payment_method`, `transfer_data`, `application_fee_amount = depositPlatformFeeCents`
- Create **Balance PI**: `amount = (totalPriceCents - depositAmountCents)`, `capture_method: 'manual'`, `confirm: true`, `payment_method`, `transfer_data`, `application_fee_amount = balancePlatformFeeCents`
- DB transaction: insert `orders` (depositAmount set), insert `order_dishes`, insert two `order_payments` rows — type `'deposit'` (status `'authorized'`), type `'balance'` (status `'authorized'`)

Fee split formula: `depositPlatformFeeCents = round(totalPlatformFeeCents × depositAmountCents / totalPriceCents)`, `balancePlatformFeeCents = totalPlatformFeeCents - depositPlatformFeeCents`

Note: platform fee is proportionally split — `depositPlatformFee + balancePlatformFee = totalPlatformFee`

### Response
```typescript
{ orderId: string, depositClientSecret?: string, balanceClientSecret?: string }
```
Client secrets returned only if 3DS challenge is required.

---

## 5. Deposit Release (On Cook Confirmation)

When cook confirms an order (`PATCH /api/business/dashboard/orders/[orderId]/status` with `{ status: 'confirmed' }`):

1. Look up `order_payments` row where `type = 'deposit'` and `status = 'authorized'`
2. If found: `stripe.paymentIntents.capture(depositPiId)` — `transfer_data` on the PI routes the cook's share automatically (no manual transfer needed)
3. Update `order_payments` row: `status = 'released'`, `releasedAt = now()`

The deposit is now with the cook. The client cannot get it back — `transfer_data` destination charge has already settled.

**Cook cancels after confirmation:** `stripe.transfers.createReversal(depositTransferId)` pulls the deposit back from the cook's Stripe balance (possible as long as the cook's balance covers it). If balance is insufficient, the platform absorbs the refund and settles out-of-band.

---

## 6. Subscription Escrow Fix

### Problem
Current code creates products/prices on the connected account but subscriptions on the platform — this is architecturally wrong for destination charges and won't work in production.

### Fix
1. **`lib/stripe-subscriptions.ts`**: Remove `{ stripeAccount: connectedAccountId }` from `getOrCreateStripeProduct` and `createStripePrice`. Products and prices now live on the platform account.
2. **`app/api/subscriptions/route.ts`**: Remove `transfer_data` from `createStripeSubscription`. Subscription payments are captured on the platform; the cook's share is transferred manually at pickup.
3. **`lib/stripe-subscriptions.ts` — `createStripeSubscription`**: Keep `application_fee_percent` but remove `transfer_data`. Also remove `capture_method: 'manual'` from payment settings — subscriptions use immediate capture (the manual capture window is too short for non-weekly plans).

### Webhook — `invoice.payment_succeeded` update
When a subscription invoice is paid, funds land on the platform (no auto-transfer). The handler already creates `order_payments` with `status: 'authorized'` — change this to `status: 'held'` to reflect that the money is captured on the platform, awaiting pickup.

Also: retrieve and store `stripeChargeId` from the invoice. In Stripe v22 the charge is reachable via `stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] })` → `pi.latest_charge.id`. Store on the `order_payments` row so the `charge.refunded` webhook can look up the payment record.

---

## 7. Pickup Verification — Escrow Release

Route: `POST /api/business/dashboard/orders/[orderId]/verify-code`  
Already verifies the PIN and marks the order `fulfilled`. Add payment release logic:

### One-time, no deposit (`type = 'full'`, status `'authorized'`)
- `stripe.paymentIntents.capture(piId)` — transfer_data routes cook's share automatically
- Update: `status = 'released'`, `releasedAt`

### One-time, with deposit (two rows)
- Deposit row (`type = 'deposit'`): already `released` from confirmation step — skip
- Balance row (`type = 'balance'`, status `'authorized'`):
  - `stripe.paymentIntents.capture(balancePiId)`
  - Update: `status = 'released'`, `releasedAt`

### Subscription (`type = 'full'`, status `'held'`)
- `stripe.transfers.create({ amount: cookPayoutCents, currency: 'cad', destination: cook.stripeAccountId })`
- Update: `stripeTransferId`, `status = 'released'`, `releasedAt`

---

## 8. Cancellation & Refund Logic

Cancellation touches two routes:
- Cook cancels: `PATCH /api/business/dashboard/orders/[orderId]/status` with `{ status: 'cancelled', reason?: 'client_no_show' }`
- Client cancels: new `DELETE /api/orders/[orderId]` (currently no client cancel route exists for post-pending orders)

### Capture amount formula
```
withinLateCancelWindow = now > pickupAt - lateCancelWindowHours * hours
lateCancelFee = lateCancelFeeEnabled && withinLateCancelWindow
              ? (lateCancelFeeType === 'flat' ? lateCancelFeeValue : totalPrice × lateCancelFeeValue/100)
              : 0
captureFloor = max(depositAmount ?? 0, lateCancelFee)
captureFloor = min(captureFloor, totalPrice)   // can't exceed order total
```

### Scenario matrix

| Canceller | Condition | Deposit PI | Balance / Full PI |
|---|---|---|---|
| Cook cancels | Before confirmation (deposit not yet transferred) | Refund deposit PI | Cancel balance/full PI |
| Cook cancels | After confirmation (deposit already transferred) | Reverse transfer from cook's balance; refund to client | Cancel balance/full PI |
| Client cancels | Before cook confirms | Refund deposit PI | Cancel balance/full PI |
| Client cancels | After confirmation, `captureFloor = 0` | Already released to cook — non-refundable | Cancel full PI → full refund |
| Client cancels | After confirmation, `captureFloor > 0` | Already released — cook keeps | Partially capture `captureFloor` from balance/full PI; refund remainder |
| Cook marks `client_no_show` | Any | Already released to cook | Capture full balance PI → transfer to cook |

### DB updates on cancellation
- `orders.cancelledAt`, `orders.cancelledBy`, `orders.lateCancelFeeApplied` (if fee applied)
- `order_payments`: update `status` to `'refunded'` (refunded rows) or `'released'` (captured rows)
- `order_payments.stripeRefundId` on refunded rows

### Partial capture mechanics (late cancel fee on one-time PI)
1. Update PI's `application_fee_amount` proportionally to `captureFloor`: `newFee = round(captureFloor × platformFeePct / 100)`
2. `stripe.paymentIntents.capture(piId, { amount_to_capture: captureFloorCents })`
3. Uncaptured remainder is automatically voided by Stripe

---

## 9. New Webhook Handlers

Add to `app/api/webhooks/stripe/route.ts`:

| Event | Action |
|---|---|
| `payment_intent.payment_failed` | Find `order_payments` by `stripePaymentIntentId` → set `status = 'pending'` (allows retry or cancellation) |
| `charge.dispute.created` | Find `order_payments` by `stripeChargeId` → set `status = 'disputed'` |
| `charge.refunded` | Find `order_payments` by `stripeChargeId` → set `status = 'refunded'`, `stripeRefundId`, `refundedAt` |

---

## 10. Local Dev Setup (No Mocks — Real Test Credentials)

All mock guards are removed. Local dev uses real Stripe test-mode API calls with test cards and test Connect accounts. No `NODE_ENV` branching in any payment route.

### Remove these mock paths
- `app/api/setup/stripe-connect/route.ts` — remove 501 production guard and `mock_acct_` path; implement real Express account creation unconditionally
- `app/api/business/dashboard/stripe/status/route.ts` — remove `isDevMode` block that returns fake `chargesEnabled: true`
- `app/api/business/dashboard/stripe/onboarding-link/route.ts` — remove mock URL block
- `app/api/business/dashboard/stripe/dashboard-link/route.ts` — remove mock URL block
- `app/api/webhooks/stripe/route.ts` — remove `STRIPE_WEBHOOK_INSECURE_DEV` bypass entirely

### Local webhook forwarding (Stripe CLI)
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
The CLI prints a signing secret (`whsec_...`). Add it to `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```
The webhook handler already verifies signatures — this just gives it a real secret to verify against.

### Test cards
| Scenario | Card number |
|---|---|
| Successful payment | 4242 4242 4242 4242 |
| 3DS required | 4000 0000 0000 3220 |
| Always declines | 4000 0000 0000 9995 |
| Insufficient funds | 4000 0000 0000 9995 |

Expiry: any future date. CVC: any 3 digits. Postal: any.

### Test Connect accounts
`stripe.accounts.create({ type: 'express', ... })` works in test mode. Complete the Express onboarding at the returned URL using Stripe's pre-filled test data flow.

### Stripe Dashboard — production webhook endpoint
When deploying, register `https://<production-domain>/api/webhooks/stripe` in Stripe Dashboard → Developers → Webhooks with these events:
- `invoice.payment_succeeded`, `invoice.payment_failed`
- `customer.subscription.deleted`, `customer.subscription.updated`
- `payout.created`, `payout.paid`, `payout.failed`, `payout.canceled`
- `payment_intent.payment_failed`
- `charge.dispute.created`, `charge.refunded`
- `account.updated`

### Stripe Connect settings
- Enable Express accounts in Stripe Dashboard → Connect Settings
- Set platform name, icon, and redirect URLs for Express onboarding

---

## 11. Files Touched

| File | Change |
|---|---|
| `db/schema/enums.ts` | Add `paymentTypeEnum` |
| `db/schema/listings.ts` | Add deposit fields |
| `db/schema/orders.ts` | Add deposit snapshot fields |
| `db/schema/payments.ts` | Drop unique on `order_id`, add `type` field, add composite unique |
| `lib/stripe-subscriptions.ts` | Remove `stripeAccount` from product/price; remove `transfer_data` + `capture_method:manual` from subscriptions |
| `lib/stripe-payments.ts` | **New** — one-time PI creation helpers (create deposit PI, balance PI, full PI, release helpers) |
| `app/api/setup/stripe-connect/route.ts` | Replace 501 stub with real Express account creation |
| `app/api/orders/route.ts` | **New** — client order placement with payment |
| `app/api/orders/[orderId]/route.ts` | **New** — client order cancellation (DELETE) |
| `app/api/subscriptions/route.ts` | Remove `transfer_data` from subscription creation call |
| `app/api/business/dashboard/orders/[orderId]/status/route.ts` | Add deposit release on confirm; add refund/capture logic on cancel |
| `app/api/business/dashboard/orders/[orderId]/verify-code/route.ts` | Update capture logic for deposit/balance/subscription variants |
| `app/api/webhooks/stripe/route.ts` | Add `payment_intent.payment_failed`, `charge.dispute.created`, `charge.refunded` handlers; update subscription payment to `status: 'held'` |
| `.env.local` | Add `STRIPE_WEBHOOK_SECRET` |

---

## 12. Out of Scope

- Frontend payment UI (Stripe Elements, saved card management)
- Stripe Billing Portal for subscription self-service
- Payout scheduling / manual payout triggers
- Dispute resolution workflow beyond status tracking
