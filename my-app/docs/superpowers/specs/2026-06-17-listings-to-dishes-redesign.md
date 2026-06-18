# 7eats Launch Redesign: Listings → Dishes

**Date:** 2026-06-17
**Status:** Draft — pending implementation planning
**Scope:** Database schema, API layer, frontend (client + business dashboard)

---

## 1. Context and Motivation

The current data model centres everything around _listings_ — a cook creates a listing, attaches dishes to it, sets a price on the listing, and clients order the listing. This indirection added complexity without user value for launch.

The revised model removes listings as a user-facing concept. Dishes (meals) become the primary unit of discovery and purchase. Each dish carries its own price. Cooks are the browse entry point; clicking a cook opens a menu page showing their active dishes. Cart and checkout work across multiple dishes from a single cook.

Subscriptions are preserved in the codebase for a future phase but are removed from all user-facing flows.

---

## 2. Guiding Constraints

- Existing deprecated tables (`listings`, `listing_dishes`, `listing_bundles`, `listing_promotions`, `listing_subscription_tiers`, `client_subscriptions`, `savedListings`) are kept in the database for historical order data. No new writes.
- All schema changes go through Drizzle migrations (`pnpm db:generate && pnpm db:migrate`).
- Complex writes (order creation, promo increment, cancellation + refund) use service_role; client JWTs are never trusted for financial mutations.
- RLS policies enforce access control at the database level for every mutable table.
- No deposit flow. No subscription flow. No volume/bundle pricing.

---

## 3. Database Schema Changes

### 3.1 `dishes` — add price, rewrite public RLS

**Add column:**
```
price  numeric(10,2)  NOT NULL  check > 0
```

**Rewrite `dishes_select_public` RLS:**
```sql
-- before (joins through listing_dishes → listings)
dish_id IN (SELECT ld.dish_id FROM listing_dishes ld
  JOIN listings l ON l.id = ld.listing_id WHERE l.status = 'active')

-- after
status = 'active'
```

**All dish child tables** (`dish_photos`, `dish_ingredients`, `dish_nutrition`, `dish_tags`) — rewrite their public select RLS from the same listing join to:
```sql
dish_id IN (SELECT id FROM dishes WHERE status = 'active')
```

### 3.2 `cook_profiles` — order rules + cancellation policy

**Add columns:**
```
minOrderQty       integer  NOT NULL  default 1   check >= 1
maxOrderQty       integer  nullable               check IS NULL OR >= minOrderQty
cancellationAllowed  boolean  NOT NULL  default false
```

**Deprecate** (keep columns, stop writing): `lateCancelFeeEnabled`, `lateCancelFeeType`, `lateCancelFeeValue`, `lateCancelWindowHours`

**Drop check constraint:** `cook_profiles_late_cancel_window_positive` (`lateCancelWindowHours >= 1`) — column stays nullable/unused; the check would reject null values if rows are ever backfilled.

### 3.3 `orders` — remove listing dependency, simplify

**Make nullable:**
- `listingId` (was NOT NULL FK restrict → now nullable FK **set null**). Changed from restrict to set null so that the deprecated `listings` table can eventually be dropped without requiring this column to be removed first.
- `quantity` (was NOT NULL → nullable)
- `unitPrice` (was NOT NULL → nullable)

**Remove FK reference:** `promotionId` loses its FK to `listingPromotions` (becomes a plain nullable uuid — the referential context is now at `order_dishes` level)

**Add column:**
```
cancellationAllowed  boolean  NOT NULL  default false
```
Snapshotted from `cook_profiles.cancellationAllowed` at order creation time so refund eligibility is fixed even if the cook later changes their policy.

**Drop check constraints:**
- `orders_quantity_positive` (`quantity >= 1`) — quantity is now nullable
- `orders_unit_price_positive` (`unitPrice > 0`) — unitPrice is now nullable

**Deprecate** (keep, no new writes): `lateCancelFeeEnabled`, `lateCancelFeeType`, `lateCancelFeeValue`, `lateCancelWindowHours`, `lateCancelFeeApplied`, `depositEnabled`, `depositType`, `depositValue`, `depositAmount`, `subscriptionId`

**Rewrite `orders_insert_client` RLS:**
```sql
-- before (validates listing price, promotion, total math)
client_id = auth.uid()
AND status = 'pending'
AND EXISTS (SELECT 1 FROM listings l WHERE l.id = orders.listing_id ...)
AND orders.total_price = orders.unit_price * orders.quantity - ...
AND (orders.promotion_id IS NULL OR EXISTS (...))

-- after (structural validation only; financial logic is in service_role)
client_id = auth.uid() AND status = 'pending'
```

### 3.4 `order_dishes` — per-dish pricing and promotions

**Add columns:**
```
priceSnapshot   numeric(10,2)  NOT NULL
promotionId     uuid           nullable  FK → dish_promotions ON DELETE SET NULL
discountAmount  numeric(10,2)  nullable  check IS NULL OR >= 0
lineTotal       numeric(10,2)  NOT NULL  check >= 0
```

`lineTotal = priceSnapshot * quantity - COALESCE(discountAmount, 0)`

### 3.5 `reviews` — decouple from listings

**Change `listingId`:** NOT NULL FK restrict → nullable FK set null

**Rewrite `reviews_insert_client` RLS:**
```sql
-- before (validates o.listing_id = reviews.listing_id)
client_id = auth.uid()
AND EXISTS (SELECT 1 FROM orders o
  WHERE o.id = reviews.order_id
    AND o.client_id = auth.uid()
    AND o.status = 'fulfilled'
    AND o.cook_id = reviews.cook_id
    AND o.listing_id = reviews.listing_id)  ← remove this line

-- after
client_id = auth.uid()
AND EXISTS (SELECT 1 FROM orders o
  WHERE o.id = reviews.order_id
    AND o.client_id = auth.uid()
    AND o.status = 'fulfilled'
    AND o.cook_id = reviews.cook_id)
```

### 3.6 New table: `dish_promotions`

```
id          uuid          PK  defaultRandom
dishId      uuid          NOT NULL  FK → dishes ON DELETE CASCADE
type        promotionType NOT NULL  (percentage_off | fixed_off)
value       numeric(10,2) NOT NULL  check > 0
                                    check: if percentage_off → value <= 100
maxUses     integer       nullable  check >= 1
usesCount   integer       NOT NULL  default 0   check >= 0
                                    check: maxUses IS NULL OR usesCount <= maxUses
isActive    boolean       NOT NULL  default true
validFrom   timestamp     nullable
validUntil  timestamp     nullable  check: if both set → validUntil > validFrom
createdAt   timestamp     NOT NULL  defaultNow
updatedAt   timestamp     NOT NULL  defaultNow  $onUpdate
```

**Unique partial index:**
```sql
UNIQUE (dish_id) WHERE is_active = true
```
Enforces one active promotion per dish at the database level.

**Business rule (enforced at API layer):** exactly one of `validUntil` or `maxUses` must be set (XOR). Neither or both → 422.

**RLS policies:**
- Public select: `isActive = true AND dish_id IN (SELECT id FROM dishes WHERE status = 'active') AND (validFrom IS NULL OR validFrom <= NOW()) AND (validUntil IS NULL OR validUntil > NOW()) AND (maxUses IS NULL OR usesCount < maxUses)`
- Cook select own: `dish_id IN (SELECT d.id FROM dishes d JOIN cook_profiles cp ON d.cook_id = cp.id WHERE cp.user_id = auth.uid())`
- Admin select: `auth.role() = 'admin'`
- Cook insert own: same cook ownership check as select own
- Cook update own: same; also blocks reducing `maxUses` below current `usesCount`
- Service_role update: `auth.role() = 'service_role'` (for usesCount increment)
- Cook delete own: only if `usesCount = 0`; otherwise soft-deactivate via update

### 3.7 Deprecated tables (schema unchanged, no new writes)

`listings`, `listing_dishes`, `listing_bundles`, `listing_promotions`, `listing_subscription_tiers`, `client_subscriptions`, `savedListings`

### 3.8 Unaffected tables

`cook_pickup_windows`, `tags`, `cook_profile_tags`, `cook_applications`, `setup_tokens`, `cook_certifications`, `followedCooks`, `orderPayments`, `cookPayouts`, `cookAgreements`, `stripeWebhookEvents`, `conversations`, `messages`, `userPreferences`, `cookNotificationReads`

---

## 4. API Layer

### 4.1 Removed endpoints

```
GET    /api/listings
GET    /api/listings/[listingId]
GET    /api/listings/[listingId]/reviews
GET    /api/cooks/[cookId]/listings
POST/GET/PATCH/DELETE  /api/business/listings/**
GET/POST               /api/favourites/listings
DELETE                 /api/favourites/listings/[listingId]
GET/PATCH              /api/subscriptions/[subscriptionId]
```

### 4.2 Relocated endpoints

Path changes only; business logic preserved:

| From | To |
|------|----|
| `/api/business/listings/dishes` | `/api/business/dishes` |
| `/api/business/listings/dishes/[dishId]` | `/api/business/dishes/[dishId]` |
| `/api/business/listings/dishes/[dishId]/archive` | `/api/business/dishes/[dishId]/archive` |
| `/api/business/listings/dishes/[dishId]/ingredients/**` | `/api/business/dishes/[dishId]/ingredients/**` |
| `/api/business/listings/dishes/[dishId]/nutrition/**` | `/api/business/dishes/[dishId]/nutrition/**` |
| `/api/business/listings/dishes/[dishId]/photos/**` | `/api/business/dishes/[dishId]/photos/**` |
| `/api/business/listings/dishes/[dishId]/tags/**` | `/api/business/dishes/[dishId]/tags/**` |
| `/api/business/listings/_lib/cook-auth.ts` | `/api/business/_lib/cook-auth.ts` |

Additionally, the `POST /api/business/dishes` (create dish) and `PATCH /api/business/dishes/[dishId]` (edit dish) now require and accept a `price` field.

### 4.3 Modified endpoints

**`GET /api/cooks`**
Returns cook cards for the browse page.
- Query params: `lat` (float, optional), `lng` (float, optional)
- When `lat`/`lng` provided, results are ordered by distance to cook's `pickupLat`/`pickupLng` (haversine); distance in km included in each result
- Response per cook: `id`, `displayName`, `photoUrl`, `bio`, `tags`, `leadTime`, `delivery` (`none` | `self` — frontend shows delivery option only when `delivery = 'self'`), `pickupCity`, `rating` (aggregate), `reviewCount`, `representativeDishPhoto` (first active dish photo ordered by dish `sortOrder` ASC, then photo `sortOrder` ASC), `distanceKm` (nullable)

**`GET /api/cooks/[cookId]`**
- Add to response: `minOrderQty`, `maxOrderQty`, `cancellationAllowed`, `leadTime`
- Remove: any listing-related fields

**`GET /api/cooks/[cookId]/reviews`**
- No structural change
- Add `dishes: string[]` to each review response (dish titles from `orderId → order_dishes → dishes` join) for social proof display

**`POST /api/orders`**

Request body:
```json
{
  "cookId": "uuid",
  "dishes": [
    { "dishId": "uuid", "quantity": 2, "promotionId": "uuid | null" }
  ],
  "fulfillmentMode": "pickup | delivery",
  "pickupAt": "ISO 8601 timestamp",
  "deliveryAddress": { "street": "...", "city": "...", ... } | null,
  "notes": "string | null"
}
```

**leadTime enum → time offset mapping** (used in step 2 and cancellation):
| enum value | offset |
|---|---|
| `same_day` | 0 hours (pickupAt must be same calendar day as now in cook's timezone; treat as 0h offset) |
| `1_day` | 24 hours |
| `2_days` | 48 hours |
| `3_days` | 72 hours |
| `4_days` | 96 hours |
| `5_days` | 120 hours |

**Stripe failure handling:** The Stripe PaymentIntent is created **before** any DB writes (step 1 below). If PI creation fails, the handler returns 500 with no DB state written — no compensating rollback needed. If DB writes subsequently fail after a successful PI creation, the orphaned PI will expire unused (no charge is captured). This is the accepted trade-off over a 2-phase commit.

Server logic:
1. Load and verify cook: `status = 'active'`, read `minOrderQty`, `maxOrderQty`, `leadTime`, `cancellationAllowed`, `platformFeePct`
2. Validate `pickupAt >= now + leadTime` (using mapping above); `pickupAt` is required for new orders — return 422 if absent
3. Validate total quantity (sum of all `dishes[].quantity`) >= `minOrderQty` AND <= `maxOrderQty` (if set)
4. For each dish: verify `status = 'active'` and `cookId` matches; read `price` as `priceSnapshot`
5. For each `promotionId` (if provided): issue `SELECT ... FOR UPDATE` on the `dish_promotions` row to prevent concurrent overselling, then verify: `isActive`, belongs to that exact `dishId`, within date window, `usesCount < maxUses` (if maxUses set). Return 422 with which dish failed if any check fails.
6. Compute per dish: `discountAmount` based on `type` + `value` + `priceSnapshot * quantity`; `lineTotal = priceSnapshot * quantity - discountAmount`
7. Sum all `lineTotal` → `subtotal`; compute `deliveryFeeSnapshot` if delivery (via distance + cook's rate)
8. `totalPrice = subtotal + deliveryFeeSnapshot`
9. **Create Stripe PaymentIntent for `totalPrice` (before DB writes).** If Stripe returns an error, return 500 — nothing has been written.
10. Open DB transaction: write `orders` row (status = `pending`, snapshot `cancellationAllowed`, `totalPrice`, `deliveryFeeSnapshot`, `fulfillmentMode`, `pickupAt`), write `order_dishes` rows (`dishId`, `dishName` snapshot, `quantity`, `priceSnapshot`, `promotionId`, `discountAmount`, `lineTotal`), increment `usesCount` on each used `dish_promotions` row, write `orderPayments` row (status = authorized, Stripe PI id). Commit.
11. Return `{ orderId, clientSecret }`

Note: `totalPrice` on `orders` must equal the sum of all `order_dishes.lineTotal` values. This is asserted in the service_role creation code — both are computed from the same in-memory data before any writes, so they are always consistent.

**`PATCH /api/orders/[orderId]`** (client cancellation)
- Client sends `{ "status": "cancelled" }`
- Server reads order's snapshotted `cancellationAllowed` and `pickupAt`; reads cook's `leadTime` **live** from `cook_profiles`. This is intentional: if a cook changes their lead time, the cancellation window shifts for all existing orders. Acceptable trade-off for launch; can be fixed by adding a `leadTimeSnapshot` column later if needed.
- `pickupAt` null case: if `pickupAt IS NULL`, the order is cancelled (status + timestamps updated) but **no refund is issued** regardless of `cancellationAllowed`. A client cannot receive a refund on an order with no scheduled pickup time.
- Refund condition: `cancellationAllowed = true AND pickupAt IS NOT NULL AND now < pickupAt - leadTime`
- If refund: service_role issues Stripe refund (full amount), updates `orderPayments` status, sets `cancelledAt` and `cancelledBy`
- If no refund: same status/timestamp update, no Stripe call
- Returns `{ refunded: boolean }`

**`POST /api/orders/[orderId]/reviews`**
- Remove `listingId` from request body and from RLS/validation
- Validate: `orderId` belongs to `clientId = auth.uid()`, `status = 'fulfilled'`, `cookId` matches
- Dish context is implicit from the order

**`PATCH /api/business/dashboard/settings`**
- Accept: `minOrderQty` (integer, >= 1), `maxOrderQty` (integer, nullable, >= minOrderQty if set), `cancellationAllowed` (boolean)
- Reject: any `lateCancelFee*` fields (removed from UI; old values stay in DB untouched)

### 4.4 New endpoints

**`GET /api/cooks/[cookId]/menu`** — public

If the cook profile is not found (inactive user account, setup incomplete, or non-existent id) the RLS filter returns no row — respond with **404**. Do not return an empty `dishes` array for an unknown cook.

Response:
```json
{
  "cook": {
    "id", "displayName", "photoUrl", "bio",
    "minOrderQty", "maxOrderQty", "leadTime",
    "delivery", "cancellationAllowed", "pickupCity",
    "pickupWindows": [{ "dayOfWeek", "fromTime", "toTime" }]
  },
  "dishes": [
    {
      "id", "title", "description", "price",
      "photos": [{ "url", "sortOrder" }],
      "tags": [{ "slug", "label" }],
      "promotion": {
        "id", "type", "value", "validUntil", "maxUses", "usesCount"
      } | null
    }
  ]
}
```
- Only `status = 'active'` dishes returned
- Promotion: single active row (guaranteed unique by partial index)
- Dishes ordered by `sortOrder`

**`GET /api/business/dishes/[dishId]/promotions`**
All promotions for a dish, ordered by `createdAt DESC`. Cook sees all `isActive` states.

**`POST /api/business/dishes/[dishId]/promotions`**
- Validates: dish belongs to authenticated cook, `type` valid, `value` valid for type
- Enforces XOR: exactly one of `validUntil` or `maxUses` must be set — 422 if both or neither
- `validUntil` must be a future timestamp (if set)
- If another active promotion exists for this dish: automatically deactivates it before inserting (handled before the INSERT; the unique partial index is a safety net, not the primary gate)

**`PATCH /api/business/dishes/[dishId]/promotions/[promotionId]`**
- Same XOR validation on save
- Cannot set `maxUses` below current `usesCount`

**`DELETE /api/business/dishes/[dishId]/promotions/[promotionId]`**
- Hard delete if `usesCount = 0`
- Soft deactivate (`isActive = false`) if `usesCount > 0` — preserves referential integrity for `order_dishes.promotionId`

**`POST /api/business/dishes/[dishId]/promotions/[promotionId]/toggle`**
- Toggle `isActive`
- On activate: deactivate any other currently active promotion for this dish first

### 4.5 Unchanged endpoints

Auth flows, setup/onboarding, Stripe Connect, stripe status/dashboard-link, payouts, earnings, notifications, messaging, availability (pickup windows), delivery distance, address geocode, `GET /api/favourites/cooks`, `DELETE/POST /api/favourites/cooks/[cookId]`, business profile, client preferences, cook-side order status transitions, verify-code, stripe webhook handler, tags.

---

## 5. Frontend

### 5.1 Client app (`app/app/`)

#### Pages removed / redirected
- `app/app/listings/[id]/page.tsx` — remove; `/app/listings/*` redirects to `/app/browse` in `proxy.ts`
- `app/app/subscriptions/page.tsx` — remove; route returns 404 for launch
- `app/app/saved/page.tsx` — hide from nav for launch (saved listings concept gone; saved cooks via `followedCooks` is a future iteration)

#### New page: `app/app/cooks/[id]/menu/page.tsx`
The core ordering experience. Data from `GET /api/cooks/[cookId]/menu`.

Layout (mirrors old listing detail page structure):
- **Left panel:** dish cards. Each card shows photo, title, description, price, active promotion badge ("10% off" or "$3 off"), quantity stepper (defaulting to 0). Clicking a card opens `_DishModal` (adapted from old `listings/[id]/_DishModal.tsx`) showing full dish detail.
- **Right panel:** live order summary — selected dishes, quantities, line totals, promotion discounts, subtotal, delivery fee (if applicable), total. Fulfillment selector (pickup/delivery). Pickup time picker (constrained to cook's pickup windows and lead time). Min/max order enforcement shown as inline feedback (e.g. "Minimum 2 items"). Link to cook's profile page. "Go to checkout" CTA — disabled until min order met.
- No subscription tab.

#### Modified: `app/app/browse/page.tsx`
Replaces listing card grid with cook card grid.

Cook card anatomy:
- Banner area: first active dish photo as background image
- Cook avatar circle overlaid on banner
- Kitchen name, city, distance (if location available)
- Cuisine/diet tags
- Star rating + review count
- Clicking card body → `/app/cooks/[id]/menu`

Featured strip (top of browse, horizontal scroll):
- Each entry: cook avatar circle + name below
- Clicking a featured cook avatar → `/app/cooks/[id]` (profile page)
- This is the only way to reach the cook profile directly from browse; the card body always goes to the menu

Data from `GET /api/cooks` with optional `lat`/`lng` passed from `_address-bar.tsx`.

#### Modified: `app/app/search/page.tsx`
Search cooks by name, tags, city instead of listings.

#### Modified: `app/app/cooks/[id]/page.tsx`
Cook profile page:
- Add policy section: min order, max order, cancellation policy (human-readable: "Cancellations accepted before [leadTime] before pickup" or "No cancellations")
- Reviews section: each review shows dish names ordered ("Ordered: Jerk Chicken, Rice & Peas") via the `dishes[]` field on the review response
- "Order now" button → `/app/cooks/[id]/menu`

#### Modified: `app/app/_cart-context.tsx`
Rewritten for multi-dish, single-cook cart.

Cart shape:
```ts
type CartItem = {
  dishId: string
  title: string
  price: number           // base price
  quantity: number
  promotionId: string | null
  discountAmount: number  // 0 if no promotion
  lineTotal: number       // (price * quantity) - discountAmount
}

type Cart = {
  cookId: string
  cookName: string
  minOrderQty: number
  maxOrderQty: number | null
  items: CartItem[]
  fulfillmentMode: 'pickup' | 'delivery'
  pickupAt: string | null
  deliveryAddress: object | null
  deliveryFeeSnapshot: number | null  // fetched fresh from /api/delivery/distance when fulfillmentMode = 'delivery' and address is set; not persisted across sessions
  notes: string | null
}
```

Rules enforced in context:
- All items must belong to the same cook. Adding a dish from a different cook prompts a "This will clear your current cart" confirmation.
- `totalQuantity = sum(items[].quantity)` shown live against `minOrderQty`/`maxOrderQty`

#### Modified: `app/app/cart/page.tsx`
Renders `CartItem[]` shape. Shows per-dish promotion badge and discount. No subscription tier selector.

#### Modified: `app/app/checkout/page.tsx`
- Remove subscription tab
- POST to `/api/orders` with new multi-dish body
- Shows itemized dish list with promotions above payment form

#### Modified: `app/app/orders/[id]/page.tsx`
- Shows `order_dishes` list: dish name, quantity, price, promo discount (if any), line total
- Cancellation button: shown only when `cancellationAllowed = true` and `now < pickupAt - leadTime`; hidden otherwise

---

### 5.2 Business dashboard (`app/business/(dashboard)/`)

#### Nav rename
"Listings" → "Meals" in `_shell.tsx`. Nav link → `/business/dashboard/dishes`.

#### Pages removed
```
listings/[id]/page.tsx                  → delete
listings/[id]/_listing-detail-context.tsx → delete
listings/[id]/_cover-crop-modal.tsx     → delete
listings/new/page.tsx                   → delete
```

#### Pages relocated (path change, logic preserved)

| From | To |
|------|-----|
| `listings/page.tsx` | `dishes/page.tsx` |
| `listings/dishes/[id]/page.tsx` | `dishes/[id]/page.tsx` |
| `listings/dishes/[id]/_dish-detail-context.tsx` | `dishes/[id]/_dish-detail-context.tsx` |
| `listings/dishes/new/page.tsx` | `dishes/new/page.tsx` |
| `listings/_back-link.tsx` | `dishes/_back-link.tsx` |

#### `dishes/page.tsx` (was `listings/page.tsx`)
Flat dish list: photo thumbnail, title, price, status chip, active promotion badge. No listing grouping. "New meal" button → `dishes/new`.

#### `dishes/new/page.tsx`
Adds required `price` field (numeric input). Removes any listing-assignment step.

#### `dishes/[id]/page.tsx`
Two tabs:
1. **Details** — existing: title, description, photos, ingredients, nutrition, tags (unchanged logic, new path)
2. **Promotions** — new tab:
   - List of all promotions for this dish; active one at top with live badge ("ends in 3 days" / "14/50 used")
   - "Add promotion" opens inline form: type (% off / $ off), value, then radio toggle "End date" vs "Max redemptions" (one required; selecting one clears the other)
   - Inline XOR validation before save
   - Deactivate / delete actions per row

#### `settings/page.tsx`
Add "Order rules" section:
- Min order quantity (number input, default 1)
- Max order quantity (number input, optional — leave blank for no cap)
- Cancellation policy toggle: "Allow clients to cancel before the lead date for a full refund"

Remove late-cancel fee section from the UI (DB columns remain, UI is gone).

---

## 6. Key Invariants and Business Rules

| Rule | Where enforced |
|------|----------------|
| One active promotion per dish at a time | DB: unique partial index `(dish_id) WHERE is_active = true`; API: deactivate existing before insert |
| Promotion requires validUntil XOR maxUses | API layer only (not expressible as a DB check constraint) |
| `dish_promotions.value` always required | DB: `value NOT NULL` |
| Total order quantity >= minOrderQty and <= maxOrderQty | API: `POST /api/orders` service_role validation |
| All dishes in one order must belong to the same cook | API: validated in order creation |
| `cancellationAllowed` on order is snapshotted at creation | Schema: `orders.cancellationAllowed` column |
| `leadTime` read live at cancellation time | Intentional for launch; cook's lead time changes affect existing orders |
| Refund only if `cancellationAllowed = true AND pickupAt IS NOT NULL AND now < pickupAt - leadTime` | API: `PATCH /api/orders/[orderId]` |
| No refund when `pickupAt IS NULL` | API: explicit null check in cancellation handler |
| `usesCount` race condition prevented | DB: `SELECT FOR UPDATE` on `dish_promotions` row before check + increment |
| `usesCount` increment is atomic with order writes | DB: single service_role transaction (steps 10+) |
| `totalPrice` on order equals sum of `order_dishes.lineTotal` | Service_role: both computed from same in-memory data before any DB write |
| `order_dishes` is immutable after insert | No update/delete RLS policy on `order_dishes` |
| Dish hard delete blocked while referenced by orders | DB: `order_dishes.dishId` FK with `onDelete: restrict` |
| Promotion hard delete blocked if usesCount > 0 | API layer: soft-deactivate instead |
| One review per fulfilled order (not per cook) | DB: `UNIQUE (order_id)` on `reviews` table. A client with multiple fulfilled orders from the same cook can leave multiple reviews — one per order. This is intentional. |
| Reviews reference fulfilled orders only | `reviews_insert_client` RLS + API validation |
| Dish price change doesn't affect past orders | `order_dishes.priceSnapshot` is immutable snapshot |

---

## 7. Out of Scope for This Iteration

- Subscription ordering flow
- Location-based filtering on browse (lat/lng ordering is in, but no radius filter for now)
- Saved/favourited dishes
- Multi-cook cart
- Dish sort order management UI (sort field exists, no drag UI yet)
- Admin review/approval UI for dishes (status changes to `active` are currently done directly; no admin gate on dishes)
- Abandoned order cleanup: an order row with status `pending` and a Stripe PaymentIntent that was never completed (client left before paying) will persist indefinitely. No cleanup job is specified for launch. The orphaned PI expires on Stripe's side automatically; the DB row is low-risk but should be addressed post-launch with a scheduled cleanup job.
- `leadTimeSnapshot` on orders: lead time is read live from `cook_profiles` at cancellation time. If this causes disputes post-launch, add a `leadTimeSnapshot` column to `orders`.
