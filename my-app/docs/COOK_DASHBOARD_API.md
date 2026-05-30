# 7eats — Cook Dashboard API

This document covers all backend API endpoints built for the cook (business) dashboard. It is the source of truth for route contracts, request/response shapes, and schema additions made on the `business-dashboard-endpoints-part2` branch.

All routes require an authenticated cook session. Authentication is resolved via `getCookId()` which checks the session and returns the cook's profile UUID. Unauthenticated requests receive `401 { error: "Not authenticated." }`.

---

## Base path

All cook dashboard routes live under `/api/business/dashboard/`. The cook profile route lives under `/api/business/profile/`.

---

## Authentication helper

```typescript
// app/api/business/listings/_lib/cook-auth.ts
getCookId(headers: Headers): Promise<string | null>
unauthorized(): NextResponse   // 401
notFound(entity: string): NextResponse  // 404
```

---

## Orders

### `GET /api/business/dashboard/orders`

Returns a paginated list of orders for the authenticated cook.

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | `pending\|confirmed\|ready\|fulfilled\|cancelled` | — | Optional filter |
| `dateFrom` | ISO date string | — | Filter by `pickupAt >= dateFrom` |
| `dateTo` | ISO date string | — | Filter by `pickupAt <= dateTo` |
| `page` | integer ≥ 1 | `1` | |
| `limit` | 1–100 | `20` | |

**Response**
```json
{
  "success": true,
  "data": [ { "id": "...", "status": "pending", "quantity": 2, "totalPrice": "30.00", "pickupAt": "...", "listingTitle": "...", "..." } ],
  "meta": { "total": 42, "page": 1, "limit": 20 }
}
```

---

### `GET /api/business/dashboard/orders/upcoming`

Returns up to 100 in-progress orders (status `pending`, `confirmed`, or `ready`) with a future pickup time. Ordered by `pickupAt` ascending. No pagination.

---

### `GET /api/business/dashboard/orders/[orderId]`

Returns full detail for a single order including the dishes snapshot.

**Response**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "confirmed",
    "quantity": 1,
    "unitPrice": "15.00",
    "totalPrice": "15.00",
    "discountAmount": null,
    "currency": "CAD",
    "pickupAt": "...",
    "fulfilledAt": null,
    "cancelledAt": null,
    "notes": null,
    "listingId": "...",
    "listingTitle": "Dal Makhani Box",
    "clientId": "...",
    "pickupCodeExpiresAt": "...",
    "pickupCodeVerifiedAt": null,
    "pickupCodeAttempts": 0,
    "lateCancelFeeEnabled": false,
    "lateCancelFeeApplied": null,
    "createdAt": "...",
    "updatedAt": "...",
    "dishes": [
      { "id": "...", "dishId": "...", "dishName": "Dal Makhani", "quantity": 1, "sortOrder": 0 }
    ]
  }
}
```

`pickupCodeHash` is never returned.

---

### `PATCH /api/business/dashboard/orders/[orderId]/status`

Advances or cancels an order. Enforces valid state transitions only.

**Valid transitions**

| Current status | Allowed next statuses |
|---------------|----------------------|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `ready`, `cancelled` |
| `ready` | `cancelled` |

**Body**
```json
{ "status": "confirmed" }
```

Setting `cancelled` automatically writes `cancelledAt`.

---

### `POST /api/business/dashboard/orders/[orderId]/verify-code`

Verifies the pickup code provided by the client. On success, marks the order as `fulfilled`.

- Maximum 5 attempts before the code is locked
- Code must not be expired
- Returns 400 with attempt count on failure

**Body**
```json
{ "code": "482910" }
```

---

## Earnings

### `GET /api/business/dashboard/earnings`

Earnings broken down by listing for a given week or calendar month.

**Query params**

| Param | Type | Default |
|-------|------|---------|
| `period` | `week\|month` | `month` |
| `year` | integer | current year |
| `month` | 1–12 | current month |
| `week` | 1–53 (ISO) | current ISO week |

**Response**
```json
{
  "success": true,
  "data": {
    "period": { "type": "month", "year": 2026, "month": 5 },
    "summary": { "gross": 450.00, "platformFee": 33.75, "net": 416.25, "orderCount": 30 },
    "byListing": [
      { "listingId": "...", "listingTitle": "...", "orderCount": 30, "gross": 450.00, "platformFee": 33.75, "net": 416.25 }
    ]
  }
}
```

Only `fulfilled` orders are included. Platform fee is derived from `cookProfiles.platformFeePct`.

---

### `GET /api/business/dashboard/earnings/summary`

Quick summary across all time periods for the dashboard overview card.

**Response**
```json
{
  "success": true,
  "data": {
    "allTime": 1200.00,
    "thisMonth": 450.00,
    "thisWeek": 120.00,
    "pendingRelease": 60.00,
    "platformFeePct": "7.50"
  }
}
```

`pendingRelease` = sum of orders with status `pending`, `confirmed`, or `ready`.

---

## Stats

### `GET /api/business/dashboard/stats`

Dashboard overview: order counts, earnings across periods, active listings, and rating stats.

**Response**
```json
{
  "success": true,
  "data": {
    "orders": {
      "pending": 3,
      "confirmed": 1,
      "ready": 0,
      "fulfilledThisMonth": 28,
      "fulfilledAllTime": 142
    },
    "earnings": {
      "thisWeek": 120.00,
      "thisMonth": 450.00,
      "allTime": 1200.00,
      "pending": 60.00
    },
    "listings": { "active": 4 },
    "rating": { "average": 4.7, "count": 89 }
  }
}
```

---

## Payouts

### `GET /api/business/dashboard/payouts`

Paginated payout history sourced from the `cook_payouts` table (written by the Stripe webhook).

**Query params**: `page`, `limit`, `status` (`pending|in_transit|paid|failed|cancelled`)

---

### `GET /api/business/dashboard/payouts/[payoutId]`

Single payout record. Returns 404 if the payout doesn't belong to the authenticated cook.

---

## Transactions

### `GET /api/business/dashboard/transactions`

Paginated payment ledger from the `order_payments` table. Includes `listingTitle` and `pickupAt` via joins.

**Query params**: `page`, `limit`

---

### `GET /api/business/dashboard/transactions/[transactionId]`

Single transaction record with order and listing context.

**Response**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "orderId": "...",
    "status": "released",
    "totalAmount": "15.00",
    "platformFeePct": "7.50",
    "platformFeeAmount": "1.13",
    "cookPayoutAmount": "13.87",
    "currency": "CAD",
    "stripePaymentIntentId": null,
    "stripeChargeId": null,
    "stripeTransferId": null,
    "stripeRefundId": null,
    "authorizedAt": null,
    "heldAt": null,
    "releasedAt": null,
    "refundedAt": null,
    "createdAt": "...",
    "listingTitle": "Dal Makhani Box",
    "pickupAt": "...",
    "orderStatus": "fulfilled"
  }
}
```

---

## Reviews

### `GET /api/business/dashboard/reviews`

Paginated visible reviews for the authenticated cook. Includes `listingTitle`.

**Query params**: `page`, `limit`

---

### `POST /api/business/dashboard/reviews/[reviewId]/response`

Adds or updates the cook's response to a review. Writes `cookResponse` and `cookResponseAt` on the review row.

**Body**
```json
{ "response": "Thank you for your kind words!" }
```

Max 1000 characters. Returns 404 if the review doesn't belong to this cook.

---

## Availability

### `GET /api/business/dashboard/availability`

Returns the cook's current pickup availability configuration from `cook_profiles`.

**Response**
```json
{
  "success": true,
  "data": {
    "pickupDays": ["monday", "wednesday", "friday"],
    "pickupFrom": "11:00",
    "pickupTo": "18:00",
    "leadTime": "1_day",
    "maxCapacity": 20,
    "delivery": "none"
  }
}
```

---

### `PUT /api/business/dashboard/availability`

Updates availability fields. All fields are optional. Validates that `pickupTo > pickupFrom` when both are provided.

**Body** (all fields optional)
```json
{
  "pickupDays": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  "pickupFrom": "HH:MM",
  "pickupTo": "HH:MM",
  "leadTime": "same_day|1_day|2_days|3_days|4_days|5_days",
  "maxCapacity": 1–1000,
  "delivery": "none|self"
}
```

---

## Settings

### `GET /api/business/dashboard/settings`

Returns operational and notification settings for the cook.

**Response**
```json
{
  "success": true,
  "data": {
    "acceptsSpecialRequests": true,
    "lateCancelFeeEnabled": false,
    "lateCancelFeeType": null,
    "lateCancelFeeValue": null,
    "lateCancelWindowHours": 24,
    "emailNotificationsNewOrder": true,
    "emailNotificationsNewReview": true,
    "smsNotificationsNewOrder": false
  }
}
```

---

### `PATCH /api/business/dashboard/settings`

Updates any subset of the settings fields above. Returns the updated settings object.

`lateCancelFeeType`: `"flat"` | `"percentage"` | `null`

`lateCancelFeeValue`: decimal string, e.g. `"5.00"` (dollars for flat, percentage value for percentage type)

`lateCancelWindowHours`: 1–168 (up to 1 week)

---

## Cook Profile

### `GET /api/business/profile`

Returns the cook's public-facing and operational profile fields. Excludes internal fields (`userId`, `applicationId`, `stripeAccountId`, `reviewedAt`, `reviewedBy`, `reviewNotes`, `tosAcceptedAt`, `currentSetupStep`).

---

### `PATCH /api/business/profile`

Updates any subset of profile fields.

**Patchable fields**

| Field | Type | Notes |
|-------|------|-------|
| `displayName` | string 1–100 | |
| `bio` | string ≤500 | |
| `photoUrl` | URL \| null | |
| `socialLink` | URL \| null | |
| `pickupAddress` | string ≤500 | |
| `pickupDays` | string[] | |
| `pickupFrom` | string (HH:MM) | |
| `pickupTo` | string (HH:MM) | |
| `leadTime` | enum | `same_day\|1_day\|2_days\|3_days\|4_days\|5_days` |
| `maxCapacity` | integer ≥1 | |
| `delivery` | enum | `none\|self` |
| `acceptsSpecialRequests` | boolean | |
| `lateCancelFeeEnabled` | boolean | |
| `lateCancelFeeType` | enum \| null | `flat\|percentage` |
| `lateCancelFeeValue` | decimal string \| null | |
| `lateCancelWindowHours` | integer ≥1 | |

Returns 400 if no fields are provided.

---

## Stripe Connect

### `GET /api/business/dashboard/stripe/status`

Checks the cook's Stripe Connect account status.

**Dev mode** (no `STRIPE_SECRET_KEY` or non-production): returns a mock response with `mock: true`.

**Response**
```json
{
  "success": true,
  "data": {
    "hasAccount": true,
    "chargesEnabled": true,
    "payoutsEnabled": true,
    "requirementsCount": 0,
    "requirements": []
  }
}
```

`requirements` = `account.requirements.currently_due` from Stripe. Non-empty means the cook needs to complete additional verification before payouts are enabled.

---

### `POST /api/business/dashboard/stripe/dashboard-link`

Generates a Stripe Express Dashboard login link so the cook can manage their bank account, payout schedule, and tax documents.

Returns 404 if the cook has no `stripeAccountId`.

**Response**
```json
{ "success": true, "data": { "url": "https://..." } }
```

---

### `POST /api/business/dashboard/stripe/onboarding-link`

Generates a Stripe Account Link for re-entering the Connect onboarding flow. Use this when `requirements` from the status endpoint is non-empty.

Uses `NEXT_PUBLIC_APP_URL` to build `refresh_url` and `return_url`.

**Response**
```json
{ "success": true, "data": { "url": "https://..." } }
```

---

## Stripe Webhook

### `POST /api/webhooks/stripe`

Handles Stripe Connect events. No authentication — verified via `STRIPE_WEBHOOK_SECRET` signature.

**Signature verification**: When `STRIPE_WEBHOOK_SECRET` is set, the raw request body is verified with `stripe.webhooks.constructEvent()`. Failure returns 400. In dev (no secret), the body is parsed directly as JSON.

**Handled events**

| Event | Action |
|-------|--------|
| `payout.created` | Inserts a row into `cook_payouts` (status `pending`). Looks up the cook via `cookProfiles.stripeAccountId = event.account`. Amount is divided by 100 (Stripe uses cents). No-op on duplicate `stripePayoutId`. |
| `payout.paid` | Updates `cook_payouts.status` → `paid` |
| `payout.failed` | Updates `cook_payouts.status` → `failed` |
| `payout.canceled` | Updates `cook_payouts.status` → `cancelled` |
| `account.updated` | Acknowledged silently (no DB write) |

Always responds `{ received: true }` with `200`.

---

## Required environment variables

| Variable | Used by |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe Connect endpoints, webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `NEXT_PUBLIC_APP_URL` | Onboarding link `refresh_url` / `return_url` |

All Stripe endpoints fall back to mock responses when `STRIPE_SECRET_KEY` is not set, so the dashboard is fully functional in development without a Stripe account.

---

## Schema changes (migration `0003_misty_wilson_fisk.sql`)

### `reviews` table — 2 new nullable columns

| Column | Type | Notes |
|--------|------|-------|
| `cook_response` | `text` | The cook's reply text |
| `cook_response_at` | `timestamp` | When the reply was written |

### `cook_profiles` table — 3 new columns

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `email_notifications_new_order` | `boolean NOT NULL` | `true` | Email on new order |
| `email_notifications_new_review` | `boolean NOT NULL` | `true` | Email on new review |
| `sms_notifications_new_order` | `boolean NOT NULL` | `false` | SMS on new order |

Apply with: `npm run db:migrate`

---

## Common response envelope

All endpoints use a consistent envelope:

```typescript
// Success
{ "success": true, "data": T }

// Success + pagination
{ "success": true, "data": T[], "meta": { "total": number, "page": number, "limit": number } }

// Error
{ "error": "Human-readable message." }
```

HTTP status codes: `200` success, `400` validation/bad request, `401` unauthenticated, `404` not found, `500` server error.
