# Pre-Backend Critical Issues

> Generated: 2026-06-04  
> Scope: Full client/business/DB audit before backend wiring  
> Status: **Must resolve before any API integration**

---

## CRITICAL — Breaks production immediately

### 1. `"completed"` vs `"fulfilled"` status mismatch

**Files:** `app/app/orders/page.tsx:47-52`, `app/app/orders/[id]/page.tsx:32-36`, `app/app/_mock.ts`, `db/schema/enums.ts`

Mock and all client UI use `"completed"` as a terminal order status. DB enum defines `"fulfilled"`. Result: the orders list filter `["completed", "cancelled"]` never matches real data, and the order detail status tracker step `status === "completed"` never fires.

**Fix:** Replace all client-side `"completed"` references with `"fulfilled"`.

---

### 2. `"pending"` status never displayed

**Files:** `app/app/orders/page.tsx:47-52`, `app/app/orders/[id]/page.tsx:32-36`

DB creates every order with status `"pending"` by default. Client only handles `confirmed | ready | completed | cancelled` — pending orders are invisible in the active list and have no step in the status tracker.

**Fix:** Add `"pending"` to the active filter, add a `statusInfo` case, and add a first step "Awaiting confirmation" to the order detail tracker.

---

### 3. `"one-time"` (hyphen) vs DB `"one_time"` (underscore)

**Files:** `app/app/_mock.ts:CartItem`, `app/app/_cart-context.tsx`, `app/app/listings/[id]/page.tsx:150`, `app/api/orders/route.ts:224`

`CartItem.orderType` stores `"one-time"`. DB `listingType` enum stores `"one_time"`. API validates against `listing.type !== "one_time"` (underscore). Any client comparison of API response against cart value silently fails. `cartMode` computed in `_cart-context.tsx` also breaks when real listing data arrives.

**Fix:** Normalize to `"one_time"` / `"subscription"` throughout client code, OR map on API response ingestion. Pick one and be consistent.

---

### 4. Stripe card tokenization is mocked

**File:** `app/app/checkout/page.tsx:306-307`

New card payments hardcode `paymentMethodId = "pm_mock_new_card"`. This value is passed to `POST /api/orders` which forwards it to Stripe. Stripe will reject it. Real Stripe.js `createPaymentMethod()` must be called before the order POST.

**Fix:** Integrate `@stripe/stripe-js` `loadStripe` + `stripe.createPaymentMethod()` on the payment step before calling the order API. Stripe Elements or CardElement replaces raw card inputs.

---

### 5. Delivery address collected but never sent to API

**Files:** `app/app/checkout/page.tsx:38-44`, `app/api/orders/route.ts` (POST schema)

`DeliveryAddress` state is collected in Step 1 and logged at order time, but `POST /api/orders` schema (`createOrderSchema`) has no `deliveryAddress` field. The address is silently dropped. No DB column for it in `orders` table.

**Fix (2 parts):**
- Add `deliveryAddress` to the `createOrderSchema` in `/api/orders/route.ts`
- Add a `delivery_address` jsonb or separate columns to the `orders` DB schema
- Send the address in `handlePlaceOrder`

---

### 6. Fulfillment mode (`pickup`/`delivery`) not persisted

**Files:** `app/app/_cart-context.tsx:CartItem`, `app/app/checkout/page.tsx:318`, `app/api/orders/route.ts`, `db/schema/orders.ts`

`CartItem.fulfillmentMode` tracks the user's pickup/delivery choice. Checkout logs it but `POST /api/orders` never receives it. No `fulfillment_mode` column in the `orders` table. After order creation, the choice is permanently lost — order history can't distinguish pickup from delivery.

**Fix:**
- Add `fulfillment_mode` column to `orders` schema (enum: `pickup | delivery`)
- Add it to `createOrderSchema`
- Send from checkout

---

### 7. `pickupCode` shown on confirmation but API only returns it when `status = "ready"`

**Files:** `app/app/checkout/confirmation/page.tsx:96`, `app/api/orders/route.ts:142`

Checkout generates a mock `pickupCode` and passes it to the confirmation page. Real API only exposes `pickupCode` when `order.status === "ready"` (line 142 of GET handler). Showing the code immediately after checkout is incorrect — it won't exist yet in the real flow.

**Fix:** Remove pickup code from confirmation page. Show it only on the order detail page when `status === "ready"`.

---

### 8. `GET /api/orders` response missing fields the UI expects

**Files:** `app/app/orders/page.tsx:84-108`, `app/api/orders/route.ts:79-97`

API returns: `listingTitle, quantity, unitPrice, totalPrice, currency, pickupAt, notes, createdAt, pickupCode, dishes[]`

Orders list page expects: `cookName, cookInitials (for avatar), listingGradient (for cover color), pickupDate (formatted string), pickupWindow, status icon`

None of the cook fields are returned. `pickupAt` is an ISO timestamp — client needs formatted date + window strings.

**Fix:** Extend the GET query to JOIN `cook_profiles` and `auth_users` for cook name. Add a `formatPickupWindow` utility. Consider returning `cookId` and letting the client derive initials.

---

### 9. `serviceFee` shown in order detail — no DB column or API field

**Files:** `app/app/orders/[id]/page.tsx:160-163`, `app/api/orders/route.ts`

Order detail shows a `Service fee: $X` line in the totals breakdown. Mock `MockOrder.serviceFee` is hardcoded. Real API returns no service fee — it computes a `platformFeeAmount` (percentage-based, cook-facing) not exposed to clients. Totals shown to customer will be wrong.

**Fix:** Decide on a customer-facing fee model. If no explicit service fee, remove the line from order detail. If yes, add a `service_fee` column to `orders` and return it in API.

---

### 10. Tax (HST 13%) calculated client-side, never in API

**Files:** `app/app/checkout/page.tsx:221-227`, `app/app/cart/_cart-tax.ts`, `app/api/orders/route.ts`

Checkout grand total = `subtotal + HST`. API `totalPrice = basePrice × quantity − discount`. Order confirmation and order history show different totals. No `tax_amount` field in API response or DB.

**Fix:** Either:
- (a) Add `taxAmount` to the orders DB schema, calculate server-side, return in API response, or
- (b) Remove tax display from order history and show only the API total. Add tax to checkout display only as an estimate with a note.

---

### 11. `"Account → Subscriptions"` referenced everywhere — page doesn't exist

**Files:** `app/app/checkout/page.tsx:859`, `app/app/checkout/confirmation/page.tsx:122`, `app/app/_subscription-utils.ts:3`, `app/app/settings/page.tsx`

Users are told to cancel subscriptions at "Account → Subscriptions" in at least 4 places. Settings page has no such tab. No API route for listing or cancelling subscriptions exists on the client side.

**Fix:**
- Add "Subscriptions" tab to settings page
- Create `GET /api/subscriptions` (list active) and `POST /api/subscriptions/[id]/cancel` routes
- Wire them up before shipping subscription feature

---

### 12. No API or persistence for saved listings / followed cooks

**File:** `app/app/saved/page.tsx:13-32`

Favourites page uses `useState` with hardcoded seed IDs (`["listing-1", "listing-3"]`, `["cook-1", "cook-4"]`). Unsave actions update local state only — reset on every page load. No DB table for saves/follows found in schema.

**Fix:**
- Add `saved_listings (userId, listingId)` and `followed_cooks (userId, cookId)` tables to DB schema
- Create `GET /api/favourites/listings`, `POST /api/favourites/listings/[id]`, `DELETE /api/favourites/listings/[id]` (same for cooks)
- Wire the Favourites page to these endpoints

---

### 13. Inbox is 100% mock — no messaging API or DB connection

**Files:** `app/app/inbox/page.tsx`, `db/schema/messaging.ts` (schema exists but unused by client)

All message threads are local `useState`. No API calls, no DB reads. The `messaging` schema exists in DB but the client has zero routes connected to it.

**Fix:**
- Create `GET /api/inbox` (list conversation threads)
- Create `GET /api/inbox/[conversationId]/messages`
- Create `POST /api/inbox/[conversationId]/messages` (send)
- Wire inbox page to these routes

---

### 14. Preferences schema mismatch: settings ↔ onboarding ↔ DB

**Files:** `app/app/settings/page.tsx:12-17`, `app/api/auth/complete-onboarding/route.ts:8-13`, `db/schema/preferences.ts`

Three different schemas in play:
- Onboarding page sends: `dietary, allergies, goals, whyMealPrep` → matches DB ✅
- Settings page stores preferences under keys: `diet, spice, group, cuisine, frequency` → doesn't match DB ❌
- Settings preferences are also never saved (no POST call anywhere)

**Fix:**
- Align settings preference questions to `dietary, allergies, goals, whyMealPrep` schema keys
- Add `POST /api/user/preferences` (or reuse `complete-onboarding`) to save from settings
- Replace `PREFERENCE_QUESTIONS` mock with questions that match the DB fields

---

### 15. `neighborhood` in settings has no DB column

**File:** `app/app/settings/page.tsx:142-156`, `db/schema/auth.ts`

Settings page collects and displays `neighborhood`. `authUser` schema has: `firstName, lastName, email, phone, phoneVerified, onboardingCompletedAt` — no neighborhood column. The field is collected but can never be persisted.

**Fix:** Either add `neighborhood varchar(100)` to `authUser` schema, or remove the field from settings.

---

### 16. Settings notifications not persisted

**File:** `app/app/settings/page.tsx:24-29`

Four notification toggles (`new_listing, order_updates, messages, marketing`) stored in `useState` only. No DB table for notification preferences. No POST call.

**Fix:**
- Add `notification_preferences jsonb` to `authUser` or a separate `user_notification_prefs` table
- Create `PATCH /api/user/notifications` endpoint
- Wire settings toggles to it

---

### 17. Business new listing has no submission handler

**File:** `app/business/(dashboard)/listings/new/page.tsx:78-83`

`handleCreate()` sets `created: true` with a timeout then resets the form. No `POST /api/business/listings` call. Listings created in the UI are discarded.

**Fix:** Wire `handleCreate()` to `POST /api/business/listings` with the full form payload (title, description, basePrice, currency, minOrderQty, maxOrderQty, subscriptionEnabled, selectedDishes, dealType, dealValue).

---

### 18. Business listing creation missing fulfillment mode

**File:** `app/business/(dashboard)/listings/new/page.tsx`

No fulfillment field in the new listing form. Cooks cannot specify pickup / delivery / both. New listings always default to whatever the DB default is (`one_time` type, no fulfillment column).

**Fix:** Add a fulfillment selector (Pickup / Delivery / Both) to Step 1 of the new listing form and include it in the API payload. Add `fulfillment` column to `listings` DB schema if not already present.

---

### 19. Guest checkout `clientId` is undefined — API requires session

**Files:** `app/app/checkout/page.tsx:105-107`, `app/api/orders/route.ts:169-176`

Guest checkout (`checkoutMode === "guest"`) calls `POST /api/orders` which immediately calls `auth.api.getSession()` and returns 401 if no session. Guests can never complete a real order. The guest confirmation flow is entirely broken with the real API.

**Fix:** Decide: force account creation before checkout (remove guest option for real), OR implement a guest session system (stateless token, link to account post-purchase). Currently the simplest fix is to remove guest checkout until a proper solution is designed.

---

### 20. `pickupAt` is required by API — checkout never sends it

**Files:** `app/app/checkout/page.tsx`, `app/api/orders/route.ts:165`

`createOrderSchema` requires `pickupAt: z.string().datetime()`. Checkout currently sends no pickup time — it only says "Exact time confirmed after order." API will return 400 validation failure on every real order attempt.

**Fix:** Either:
- (a) Make pickup time optional in API (nullable) and let cook confirm later, or
- (b) Add a pickup time selector to the checkout fulfillment step

---

### 21. `CartItem.listingId` is a mock string, not a UUID

**Files:** `app/app/_mock.ts`, `app/api/orders/route.ts:160`

API validates `listingId: z.string().uuid()`. Mock listing IDs are `"listing-1"`, `"listing-2"`, etc. All real API calls from the checkout will fail UUID validation.

**Fix:** Update `MOCK_LISTINGS` IDs to valid UUIDs. Use `crypto.randomUUID()` to generate them once and hardcode, or use a consistent UUID format matching what the DB will produce.

---

## HIGH — Broken flows, ships broken features

| # | Issue | File |
|---|-------|------|
| 22 | `"Account → Subscriptions"` tab missing in settings | `app/app/settings/page.tsx` |
| 23 | Cook profile `following` state resets on every page load | `app/app/cooks/[id]/page.tsx` |
| 24 | Review submission button has no handler or API | `app/app/orders/[id]/page.tsx:178` |
| 25 | `order.pickupAddress` displayed but no DB column | `app/app/orders/[id]/page.tsx:127` |
| 26 | Deposit flow in API has zero client UI | `app/api/orders/route.ts:333-343` |
| 27 | `promotionId` accepted by API but checkout never sends it | `app/api/orders/route.ts:165` |
| 28 | Cancelled order has no visual state in order detail tracker | `app/app/orders/[id]/page.tsx:32-36` |
| 29 | `buildCartLines` sends mock listing IDs — UUID validation fails | `app/app/listings/[id]/page.tsx:155` |

---

## MEDIUM — Data integrity, calculation issues

| # | Issue | File |
|---|-------|------|
| 30 | Volume pricing tiers display-only, never applied to cart total | `app/app/listings/[id]/page.tsx:736` |
| 31 | Tax calculated client-side but not in API totals | `app/app/cart/_cart-tax.ts` |
| 32 | `cookGradient`/`cookInitials` are mock-only — API doesn't return them | `app/app/orders/page.tsx:84` |
| 33 | `pickupDate`/`pickupWindow` are pre-formatted strings — real API returns ISO timestamp | `app/app/orders/page.tsx:95` |
| 34 | `currencyCode` hardcoded "CAD", never validated against `listing.currency` | Multiple |
| 35 | Settings password change has no validation or confirm-password field | `app/app/settings/page.tsx:167-196` |
| 36 | Business listing edit (PATCH) doesn't persist `subscriptionEnabled` on existing listings | `app/business/(dashboard)/listings/[id]/_listing-detail-context.tsx` |

---

## Recommended fix order before backend wiring

```
SPRINT 1 — Schema alignment (no UI changes needed)
  1. "completed" → "fulfilled" + add "pending"
  2. "one-time" → "one_time" (client normalization)
  3. Add fulfillment_mode + delivery_address to orders schema
  4. Add neighborhood to authUser (or remove from settings)
  5. Update mock listing IDs to valid UUIDs

SPRINT 2 — Checkout correctness
  6. Add pickupAt to checkout (or make optional in API)
  7. Wire Stripe.js tokenization (remove pm_mock_new_card)
  8. Send deliveryAddress + fulfillmentMode to order POST
  9. Remove pickupCode from confirmation page

SPRINT 3 — Missing features
  10. Guest checkout decision (remove or implement properly)
  11. Subscriptions tab in settings + cancel API
  12. Persistence for saved listings / followed cooks
  13. Inbox messaging API wiring
  14. Notification preferences persistence

SPRINT 4 — Business side
  15. New listing form submission → POST /api/business/listings
  16. Add fulfillment mode to listing creation form
  17. Preferences schema alignment (settings keys match DB)
```
