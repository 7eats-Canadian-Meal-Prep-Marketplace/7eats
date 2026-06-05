# 7eats Client Portal — Developer Guide

> **Before reading this document, read `docs/pre-backend-critical-issues.md` first.** That file enumerates 21 CRITICAL and 8 HIGH-severity issues that will break production the moment real API calls are wired. Every section below cross-references the relevant issue numbers. Do not skip it.

---

## Overview

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router (no Pages Router) |
| React | React 19, Server Components by default; `"use client"` only where required |
| Language | TypeScript strict mode; `@/*` alias → `my-app/` |
| Database | Neon Postgres via `@neondatabase/serverless` |
| ORM | Drizzle ORM (`drizzle-orm/neon-http`) |
| Auth | Better Auth — session cookie `better-auth.session_token` |
| Payments | Stripe (PaymentIntents + Connect) — partially integrated |
| Styling | Tailwind CSS v4 + CSS Modules per page |
| Package manager | pnpm |

### Auth Model

Authentication uses Better Auth. Sessions are HTTP-only cookies (`better-auth.session_token`). The session exposes `user.id`, `user.role` (`client` | `cook` | `admin`), `user.email`, `user.firstName`, `user.lastName`, `user.phoneVerified`, `user.onboardingCompletedAt`.

A second cookie, `7eats-onboarded=1`, is written by `POST /api/auth/complete-onboarding` after the user completes the two-step onboarding flow. It is also re-issued on every subsequent sign-in (see sign-in route) so it survives cleared browsers and new devices. This cookie is the primary gate for all `/app/` routes (see Routing Protection below).

**Important:** `authUser.name` is a single concatenated string owned by Better Auth internals. Always use `authUser.firstName` and `authUser.lastName` for display and API responses.

### Routing Protection (`proxy.ts`)

The Next.js middleware at `proxy.ts` runs on every request matching `/`, `/app`, `/app/:path*`, `/app-auth/:path*`, `/business/:path*`, `/business-auth/:path*`.

| Condition | Route | Result |
|---|---|---|
| No session | `/app-auth/onboarding` | Redirect → `/app-auth/login` |
| Has session + already onboarded | `/app-auth/onboarding` | Redirect → `/app/browse` |
| Has session + NOT onboarded | Any public client route (browse, search, cart, checkout, listings/*, cooks/*) | Redirect → `/app-auth/onboarding` |
| No session OR role ≠ `client` | Protected client routes (orders/*, inbox, saved, settings) | Redirect → `/app-auth/login?next=<path>` |
| Has session + NOT onboarded | Protected client routes | Redirect → `/app-auth/onboarding` |
| Logged-in client | `/app-auth/login` or `/app-auth/signup` | Redirect → `next` param (if `/app/…`) else `/app/browse` |
| Cook/admin | `/app-auth/login` | Allowed if `next` is an `/app/` path (cross-account scenario); otherwise redirect → `/app/browse` |
| Cook/admin | `/app-auth/signup` | Always allowed (a cook can also have a client account) |
| Root `/` | Any role | Client → `/app/browse`; Cook/Admin → `/business/dashboard` |

**Public client routes** (no login required): `/app/browse`, `/app/search`, `/app/cart`, `/app/checkout`, `/app/checkout/*`, `/app/listings/*`, `/app/cooks/*`.

**Protected client routes** (session + `client` role + onboarded required): `/app/orders/*`, `/app/inbox`, `/app/saved`, `/app/settings`.

The `/app-auth/forgot-password` and `/app-auth/reset-password` routes fall through the `app-auth/` catch-all and are always accessible.

### Mock Data Philosophy

Everything browseable (listings, cooks, dishes, reviews) is currently served from `app/app/_mock.ts` — a static TypeScript module loaded at module-initialization time. All pickup dates and deadlines are computed relative to `Date.now()` at module load so urgency labels always appear live during development.

Orders, messages, favourites, and preferences are all `useState` initialized from hardcoded seeds in their respective pages. Nothing persists across page reloads.

The mock has three structural mismatches with the real DB that are critical:
1. Listing IDs are strings like `"listing-1"` — the API requires valid UUIDs. See critical issue #21.
2. `CartItem.orderType` uses `"one-time"` (hyphen) but the DB enum uses `"one_time"` (underscore). See critical issue #3.
3. Order status `"completed"` in mock must be `"fulfilled"` in DB. See critical issue #1.

---

## Auth Flow

### Signup (`/app-auth/signup`)

**Purpose:** Self-serve account creation for consumers. Cooks are provisioned through the business application flow and never use this route.

**Current behavior:** Renders `<SignupForm />` wrapped in `<ClientAuthLayout>`. The form collects `firstName`, `lastName`, `email`, and `password`.

**On submit:** `POST /api/auth/sign-up` with `{ firstName, lastName, email, password }`.

**API behavior:**
- Rate-limited: 5 attempts per IP per 60-minute window.
- If email already exists with `emailVerified = false`: resends verification link and returns `{ redirect: "/app-auth/signup/check-email?email=..." }` — no error shown.
- If email exists and is verified: returns 409 `"An account with this email already exists."`.
- On success: calls `auth.api.signUpEmail` (Better Auth), immediately patches the new row to set `role = "client"`, `status = "active"`, `firstName`, `lastName`. Sends a verification email with `callbackURL: "/app-auth/onboarding"`. Returns `{ redirect: "/app-auth/signup/check-email?email=..." }`. **No session is created at this step.**

**DB tables written:** `user` (insert via Better Auth, then immediate UPDATE for role/firstName/lastName).

**Things to replace:** Nothing specific — this route is production-ready. The only downstream gap is that `name` in Better Auth is set to `"${firstName} ${lastName}"` which makes the `name` field redundant for display purposes.

**Edge cases:**
- User submits the form twice rapidly: rate limit will catch the second attempt after the first creates the row. If the second arrives before the DB write completes, Better Auth will return a conflict and the route returns 500 "Could not create account." This is a small race window but acceptable at low volume.
- User navigates back from check-email and re-submits the same email: handled gracefully — resends the verification link.

---

### Email Verification + Check-Email (`/app-auth/signup/check-email`)

**Purpose:** Landing page after signup submission. Tells the user to check their email.

**Current behavior:** Server component. Reads `email` from `?email=` query param and displays it. Shows a "Resend" button (`<ResendButton email={email} />`).

**Backend integration points:**
- Resend button should call Better Auth's `sendVerificationEmail` API. The current `ResendButton` component makes a client-side call for this.
- When the user clicks the email link, Better Auth handles the token validation and redirects to the `callbackURL` (`/app-auth/onboarding`). At that point the session is created and the onboarding flow begins.

**DB dependencies:** Better Auth `verification` table (token storage).

**Edge cases:**
- Verification link expires: Better Auth will redirect to the callback URL with an error. This is not currently handled — the onboarding page will fail silently. You need to handle Better Auth's error redirect from email verification.
- User opens the verification link on a different device: this is fine — Better Auth creates a session on that device. The `7eats-onboarded` cookie will be absent, so the onboarding flow begins on the new device.

---

### Login (`/app-auth/login`)

**Purpose:** Credential-based sign-in for existing clients.

**Current behavior:** Renders `<LoginForm logoHref="/app/browse" signupHref="/app-auth/signup" audience="client" />`. Reads optional `?verified` query param — if present, shows a green "Email confirmed — you can now sign in." banner.

**On submit:** `POST /api/auth/sign-in` with `{ email, password, audience: "client" }`.

**API behavior:**
- Rate-limited: 5 attempts per IP per 15-minute window.
- Normalizes email to lowercase.
- If account exists with `emailVerified = false`: returns 403 prompting email confirmation.
- If `audience = "client"` but account role is `cook` or `admin`: returns 403 with instructions to use the business portal.
- If credentials are wrong: Better Auth returns non-OK; API returns 401 `"Incorrect email or password."`.
- On success: sets the Better Auth session cookie. If user has `onboardingCompletedAt != null`, also sets `7eats-onboarded=1` cookie. Returns `{ redirect: "/app/browse" }`. The frontend reads `redirect` and navigates.

**The `next` redirect flow:** The login form receives a `?next=/app/...` param (injected by the proxy when redirecting unauthenticated users from protected routes). After successful sign-in, the frontend should navigate to `next` instead of the default `/app/browse`.

**DB tables read:** `user` (role, emailVerified, onboardingCompletedAt).

**Edge cases:**
- Cook/admin who also has a client account: the `audience: "client"` check is performed against the DB role. If the same email is registered as both, only the `client` role row will pass. (In practice, cooks must create a separate email for a client account, as per proxy logic.)
- Session already exists (navigated directly): proxy redirects to browse/destination before the page renders.

---

### Forgot Password (`/app-auth/forgot-password`)

**Purpose:** Password reset request for clients who can't remember their password.

**Current behavior:** Renders `<ForgotPasswordForm expiredLink={error === "expired"} audience="client" />`. If the query param `?error=expired` is present (redirected from reset-password), shows an expired-link message.

**Backend integration:** This form is wired to Better Auth's password reset flow. Better Auth sends a reset email with a token. The token is validated client-side and the `callbackURL` for the reset link points to `/app-auth/reset-password`.

**DB dependencies:** Better Auth `verification` table.

**Ambiguities:** The `audience` prop is passed to `ForgotPasswordForm` — this likely determines the "back to sign in" link URL but you need to verify the component uses it.

---

### Reset Password (`/app-auth/reset-password`)

**Purpose:** Form to set a new password after clicking the reset email link.

**Current behavior:** Server component. Reads `token` and `error` from query params. If `error === "INVALID_TOKEN"` or no token is present, immediately redirects to `/app-auth/forgot-password?error=expired`. Otherwise renders `<ResetPasswordForm token={token} audience="client" />`.

**Backend integration:** `ResetPasswordForm` submits to Better Auth's `resetPassword` endpoint. On success, the user is typically redirected to login.

**DB dependencies:** Better Auth `verification` and `account` tables.

**Edge cases:**
- Token used twice: Better Auth invalidates tokens after first use. Second click → redirect to expired page.
- Token from wrong device: tokens are not device-bound, any valid token works.

---

## Onboarding (`/app-auth/onboarding`)

**Purpose:** Required two-step flow that every new client must complete exactly once. Gates the entire `/app/` experience via the `7eats-onboarded` cookie. The shell header is hidden during onboarding.

**Gate mechanism:** The proxy redirects any request with a session but without the `7eats-onboarded` cookie to this page. The page itself checks `phoneVerified` from the session to determine which step to start on, allowing resumption if the user closes the browser mid-flow.

### Step 1 — DOB + Phone Verification

**Purpose:** Collect date of birth for the 16+ age gate, and verify the phone number for order updates.

**Current behavior:**
- DOB input (`type="date"`, max = today). Client-side `isAtLeast16(dob)` check: computes cutoff as `today - 16 years` and rejects any DOB after the cutoff. The error message is: "You must be at least 16 years old to create an account."
- Phone input (`type="tel"`). "Send code" button is enabled once `phone.replace(/\D/g, "").length >= 10`.
- On "Send code": `POST /api/auth/client/send-otp` with `{ phone }`. On success, transitions to `code_sent` phase.
- On "Verify": `POST /api/auth/client/verify-otp` with `{ code }`. On success, transitions to `verified` phase. Phone input becomes read-only.
- "Continue" button is only enabled when `phase === "verified"`. Before navigating to Step 2, it also validates that DOB is present and the user is at least 16.
- The phone and DOB are stored in `localStorage` under key `"onboarding"` for Step 2 to read.

**Backend integration points:**
- `POST /api/auth/client/send-otp`: needs to save the phone to session or a temporary store and send the OTP (Twilio or equivalent). Should rate-limit aggressively (e.g., 3 OTPs per phone per hour).
- `POST /api/auth/client/verify-otp`: verifies the code and writes `phoneVerified = true` to `authUser`. Must return a success flag so the client transitions to `verified` phase.

**DB tables written:** `user.phone`, `user.phone_verified` (on verify-otp success).

**Things to replace:** Replace mock OTP endpoints with real Twilio/SMS provider integration.

**Ambiguities:**
- Should the DOB be validated server-side as well? Yes — the 16+ check must happen in `complete-onboarding` to prevent API bypass.
- What if the user changes their phone number after entering it but before verifying? The UI handles this: any change to the phone input resets `phase` to `"idle"`, requiring a new code.

**Edge cases:**
- User closes the browser after verifying phone but before completing Step 2: On next visit, onboarding page calls `GET /api/auth/get-session` and checks `phoneVerified`. If true, starts on Step 2 directly, but `dob` is no longer in component state. The page reads from `localStorage` to restore it. If localStorage was cleared, `dob` will be empty. Step 2 forwards `dob` in the `complete-onboarding` body — without it, `dateOfBirth` will not be saved. This is an acceptable degraded state for now.
- User enters a valid phone for an already-registered account: OTP system should not expose whether a phone is registered. Send the OTP regardless.

---

### Step 2 — Preferences

**Purpose:** Personalization data that helps match users with relevant cooks. All questions are optional.

**Current behavior:** Four question groups using chip/button toggles:
- `dietary` (multi-select): Halal, Vegan, Vegetarian, Gluten-free, Dairy-free, Nut-free, Kosher
- `allergies` (multi-select with "None" exclusion logic): Tree nuts, Peanuts, Dairy, Gluten, Shellfish, Eggs, Soy, None
- `goals` (multi-select): High protein, Weight loss, Low carb, Muscle gain, Heart health, Comfort food, Family-friendly, Balanced
- `whyMealPrep` (single-select rendered as a grid): Save time cooking, Eat healthier, Budget-friendly eating, Discover new cuisines, Support local home cooks, Convenient for my schedule

The "None" allergy option is mutually exclusive with all other allergies — selecting it clears the others, selecting any other clears "None".

On "Let's eat →": `POST /api/auth/complete-onboarding` with `{ dietary, allergies, goals, whyMealPrep, dateOfBirth }`.

**API behavior (`complete-onboarding`):**
- Requires session.
- Upserts `userPreferences` (insert or update-on-conflict by `userId`) with `{ dietary, allergies, goals, whyMealPrep }`.
- Updates `authUser.onboardingCompletedAt = now()` and `authUser.dateOfBirth` (if provided).
- Sets `7eats-onboarded=1` cookie in the response (HttpOnly, SameSite=Lax, Max-Age=1 year).
- Returns `{ success: true }`.
- On success: client calls `router.push("/app/browse")`.

**DB tables written:** `user_preferences` (upsert), `user.onboarding_completed_at`, `user.date_of_birth`.

**DB schema:** `userPreferences` has `userId`, `dietary` (json[]), `allergies` (json[]), `goals` (json[]), `whyMealPrep` (json as `why_meal_prep` column). These keys exactly match what the page sends and what `PREFERENCE_QUESTIONS` in `_mock.ts` uses.

> ⚠ See critical issue #14 — Settings page uses wrong preference keys. Onboarding is correct, but Settings page must be aligned to match.

**Edge cases:**
- User submits with no preferences selected: all arrays are empty. This is valid — `complete-onboarding` accepts empty arrays.
- User is 16 but their birthday is today: `isAtLeast16` computes `cutoff = today - 16 years`. A birthday of exactly today passes (birth <= cutoff). This is correct.

---

## Shell / Navigation (`app/app/_shell.tsx`)

The shell wraps all `/app/` and `/app-auth/` content. It is a client component that provides `AppProvider` (global fulfillment mode, login state) and `CartProvider` (cart state) to all children.

### Address Dropdown

**Purpose:** Shows the user's current delivery/pickup context address. Controls what "near you" means when distance-sorting listings.

**Current behavior:** Hardcoded initial address `"123 King St W, Toronto"`. Two hardcoded saved addresses `["123 King St W, Toronto", "456 Queen St E, Toronto"]`. The dropdown shows these two options plus "Use my location" (sets address to `"Current location"`) and "Add new address" (opens the `AddressModal`).

When a saved address is selected, `setAddress(addr)` updates local state and closes the dropdown. A checkmark (✓) appears on the currently active address.

The `AddressModal` has a free-text input and a "Use my location" button that hardcodes `"123 King St W, Toronto"` instead of using the Geolocation API.

**Backend integration points:**
- Load saved addresses from `GET /api/user/addresses` (does not exist yet) on mount.
- When a saved address is selected, update the active address in user context/session or a `user_addresses` table.
- "Add new address" should POST to `POST /api/user/addresses` and refresh the dropdown.
- "Use my location" should call `navigator.geolocation.getCurrentPosition()` and reverse-geocode the coordinates to a real address string (e.g., Google Maps Geocoding API or Mapbox).
- The active address is currently only stored in React state — it resets on every page load. It should be persisted (localStorage at minimum, server-side for logged-in users).
- The address value is not currently passed to the listing API when fetching listings. When real listing APIs are built, the address (or lat/lng) should be sent as a query parameter to compute actual distances.

**DB dependencies:** Needs a `user_addresses` table (does not exist in current schema).

**Things to replace:** Replace hardcoded address seeds with API-loaded addresses. Replace mock geolocation with `navigator.geolocation`.

**Ambiguities:**
- What is the canonical address format? Street string? Parsed components? PostGIS point? Decide before building the API.
- Should unauthenticated users be able to save addresses? Currently all address state is client-side, so it works without auth.

---

### Profile Menu

**Purpose:** Avatar button in the top-right corner for logged-in users. Shows the user's initials, name, email, and navigation links.

**Current behavior:** The `AppShell` receives `isLoggedIn`, `userInitials`, `userName`, `userEmail` as props. These are populated server-side from the Better Auth session. When logged in, the `ProfileMenu` component renders these. Menu links: Search, Favourites, Orders, Inbox, Account. Sign-out button calls `POST /api/auth/sign-out` and navigates to the returned `redirect` URL (defaults to `/app-auth/login`).

When NOT logged in, the header shows "Log in" (→ `/app-auth/login`) and "Sign up" (→ `/app-auth/signup`) buttons instead.

**DB dependencies:** None beyond the session. The shell layout reads the session server-side via Better Auth.

---

### Cart Badge

**Purpose:** Shows the count of distinct listings in the cart.

**Current behavior:** `useCart().listingCount` — count of distinct `listingId` values in the cart. The cart is in-memory `useState`. Clicking navigates to `/app/cart`.

Note: the badge shows listing count, not dish count or item count. Adding 3 dishes from 1 listing = badge shows "1".

---

### Bottom Nav

**Purpose:** Mobile navigation bar fixed to the bottom of the screen.

**Current behavior:** Present on all pages except `/app-auth/onboarding/*` and `/app/checkout/*`. Shows Search, Orders, Inbox, Account. Orders and Inbox tabs have `requiresAuth: true` — they are hidden when the user is not logged in, replaced by a "Log in" tab.

Active state is determined by `pathname === href || pathname.startsWith("${href}/")`.

---

## Browse (`/app/browse`)

**Purpose:** The main discovery feed for consumers. The default landing page for logged-in clients and the destination after sign-in.

**Current behavior:** Loads all 29 listings from `MOCK_LISTINGS`. Filters by:
1. Fulfillment mode: only shows listings where `listing.fulfillment === mode || listing.fulfillment === "both"`.
2. Deadline: only shows listings where `hoursUntil(listing.orderDeadlineIso) > 0`.

Filtered listings are organized into curated horizontal carousels:
- **Spotlight**: `listing.isSpotlight === true`
- **Hot deals**: `listing.deal !== null`
- **New on 7eats**: `listing.isNew === true`
- **Fastest near you**: all filtered listings sorted by `distanceKm` ascending
- **Weekly cooks spotlight**: static section showing all 8 cooks
- **High protein**: `listing.niches.includes("high_protein")`
- **Halal picks**: all dishes in the listing have `badges.includes("halal")`

A sticky filter bar at the top shows:
- `FulfillmentToggle` (Pickup / Delivery) — updates global `fulfillment` state via `AppContext`
- Cuisine chips — these are `<Link>` elements navigating to `/app/search?cuisine=<value>`

Carousels are paginated client-side with prev/next arrows. Cards per page is responsive: 1 (< 500px), 2 (500–759px), 3 (760–1099px), 4 (1100–1399px), 5 (≥ 1400px).

Each listing card shows: cover image, deal badge, heart/save button (only shown to logged-in users, `canSave = isLoggedIn`), stock pill (low/sold out), title, rating, cook first name, distance, price-from, subscription hint (`<RefreshCw>` icon if `listing.subscriptionEnabled`), and order-by / receive-on schedule line.

The save/unsave heart updates local `useState<Set<string>>` only — does not persist.

**Backend integration points:**

When replacing mock data:
- `GET /api/listings?fulfillment=pickup&...` — should return active listings with `ordersLeft`, `orderDeadlineIso`, cook name/initials, distance (computed from user's current address), `subscriptionEnabled`, `deal`, `isNew`, `isSpotlight`, niche tags, dietary badges.
- The carousel sections (Spotlight, Hot deals, etc.) can be driven by boolean/enum fields on the listing row or by a separate `GET /api/listings/featured` that returns section-grouped results.
- The Cook Spotlight section needs `GET /api/cooks?featured=true` or similar.
- Favourite state (heart) needs `GET /api/favourites/listings` on mount to initialize the saved set.
- Toggling the heart needs `POST` / `DELETE /api/favourites/listings/:id`.

> ⚠ See critical issue #12 — No API or persistence for saved listings. The heart on browse resets on every page load.
> ⚠ See critical issue #21 — Mock listing IDs are not UUIDs. Any API call using `listing.id` as a UUID will fail validation.
> ⚠ See critical issue #32 — `cookGradient`/`cookInitials` are mock-only fields. The real listing API must either return them or the client must derive initials from cook name.
> ⚠ See critical issue #34 — `distanceKm` is mocked. Real distance requires Google Maps Distance Matrix API or PostGIS `ST_Distance`.

**Ambiguities:**
- What "near you" means depends on the selected address, which currently resets on page load. Decide whether the address affects API filtering server-side or client-side sort only.
- Should sold-out listings (`ordersLeft === 0`) still appear in browse? Currently they do (filtered only by deadline).

**Edge cases:**
- User switches fulfillment mode: filtered listings change immediately (client-side with mock data). With a real API, a new fetch is needed on toggle.
- All listings for the selected mode have expired deadlines: shows "No listings available / Try switching to Delivery." This state can occur legitimately in off-hours.

---

## Search (`/app/search`)

**Purpose:** Full search with multi-dimensional filters and sorting. Entry point from browse cuisine chips and the header search bar.

**Current behavior:** Wrapped in `<Suspense>` to handle `useSearchParams`. Reads initial state from URL params: `?q=` (text query), `?cuisine=` (cuisine filter). Applying filters updates component state but does not update the URL — so filters are lost on page refresh and cannot be shared as links.

**Filter panel** (modal overlay): dietary restrictions, niche categories, order type (all / single order / subscription), max distance slider (1–25 km, 25 = no limit). Shows a preview count ("X found") based on draft filters before applying. Cannot apply if draft produces 0 results.

**Sort dropdown:** Best match (relevance — no re-sort, original order), Price: Low to High (`priceFrom` ascending), Price: High to Low, Top Rated (cook `rating` descending).

**Text search** matches against: listing title, listing description, cook display name, cuisine types, dish names.

**Filter logic** (all conditions must pass):
1. Fulfillment mode matches or listing supports both.
2. `hoursUntil(orderDeadlineIso) > 0`.
3. Text query matches.
4. Cuisine filter matches.
5. Dietary filter: ALL selected badges must appear on ALL dishes in the listing.
6. Niche filter: ALL selected niches must be in `listing.niches`.
7. Order type: `listing.orderType` matches (using hyphen-format `"one-time"` / `"subscription"` in the filter state, not underscore).
8. Distance: `listing.distanceKm <= f.distanceKm` (when < 25).

> ⚠ The `orderType` filter compares against `listing.orderType` which is `"one-time"` (hyphen). When real API data arrives using `"one_time"` (underscore), the filter will silently match nothing. See critical issue #3.

**Backend integration points:**
- `GET /api/listings?q=...&cuisine=...&dietary=...&niche=...&orderType=...&maxDistanceKm=...&fulfillment=...&sort=...` — server-side filtering and sorting is strongly preferred over loading all listings and filtering client-side.
- Return paginated results with total count. Current UI shows a flat grid with no pagination — you will need to add infinite scroll or a load-more button for real datasets.
- The "X found" count in the filter preview panel currently re-runs client-side filtering against all mock data on every draft change. With real data, this needs a lightweight `GET /api/listings/count?...` endpoint or the count can be returned with the first page of results.

**DB dependencies:** `listings`, `listing_dishes`, `dishes`, `cook_profiles`, `auth_user`.

**Things to replace:**
- Replace `MOCK_LISTINGS` / `MOCK_COOKS` lookup with API calls.
- Wire cuisine chip active state to URL params so filters are shareable and survive navigation.
- Persist filter state in URL for all filter dimensions, not just cuisine and query.

---

## Listing Detail (`/app/listings/[id]`)

**Purpose:** The primary ordering page. Users select dishes, choose quantities, pick fulfillment mode and order type, then add to cart.

**Current behavior:**

The page reads `params.id` and finds the listing in `MOCK_LISTINGS`. It is a client component because it reads from cart context and manages local ordering state.

**Hero section:** Cover image with gradient overlay, back button (browser history or `/app/browse` fallback), deal badge overlay.

**Layout:** Two-column on desktop (food content left, order widget right sidebar). Single column on mobile with sidebar content moved inline.

**Left column — food content:**
- Listing title with aggregate star rating and "N reviews" anchor link.
- Description.
- Subscription info banner: shown only when `listing.subscriptionEnabled === true`. Copy: "Weekly subscriptions available / Subscribe and get this automatically every week. Cancel any time."
- Cook info bar (mobile inline, desktop in sidebar): avatar, name, cuisine, neighborhood, verified badge, rating. Clicking navigates to `/app/cooks/:cookId`.
- Pickup strip (mobile inline): pickup date/window, order-by deadline, location neighborhood.
- Policy section (mobile inline, desktop as a sidebar card): deal callout, volume discount tiers, min/max order range.
- Dish list: each dish shows cover image, name, description, portion size, dietary badges, price. Clicking opens `<DishModal>` for detail view. +/− quantity controls on the right.
- Reviews section (below dishes): shown only when `MOCK_LISTING_REVIEWS[listing.id]` has entries. Shows cook aggregate rating, star display, reviewer initials avatar, date, comment, dish name.

**Right sidebar — order widget card:**
- Fulfillment selector (Pickup / Delivery): only shown when `listing.fulfillment === "both"`. Disabled when order is already in cart and not in modify mode.
- Logistics grid: price from, pickup date/window, order-by deadline.
- Spots tracker: shows `ordersLeft` remaining, fill bar.
- Selection summary: shows selected dishes × quantities + subtotal when `hasSelection`.
- Order mode toggle (Order once / Subscribe weekly): shown only when `listing.subscriptionEnabled === true` AND (`!isInCart || isModifying`). Subscribe mode sets `subscribeMode = true`.
- Weekly charge note: shown when `subscribeMode === true`. Copy from `_subscription-utils.ts`.
- Primary CTA button (disabled when no selection or min units not met):
  - No selection: "Select dishes to order"
  - Has selection, min not met: "Add N more portion(s)"
  - In cart, modifying: "Update cart · $X.00"
  - Subscribe mode: "Subscribe weekly · $X.00/wk"
  - Default: "Add to cart · $X.00"
- In-cart banner (when order is in cart and not modifying): "In cart" with "Modify order" + "View cart" links.

**Add to cart flow (`handleAddToCart`):**
1. Calls `setListingItems(listing.id, buildCartLines())` on the CartProvider.
2. `buildCartLines()` maps selected dishes to `CartItem` objects with `orderType: subscribeMode ? "subscription" : "one_time"` (uses underscore after the fix for critical issue #3), `fulfillmentMode: resolvedFulfillmentMode`.
3. Navigates to `/app/cart`.

**Modify flow:** Clicking "Modify order" calls `restoreFromCart()` (re-reads quantities from cart) and sets `isModifying = true`. The quantity controls and fulfillment/subscribe toggles become active again. "Cancel" restores from cart and clears modify mode. "Update cart" calls `setListingItems` again (replaces the listing's cart lines atomically).

**Volume discount tiers:** `listing.priceTiers` are displayed in both the mobile policy section and the sidebar policy card. They show labels like "2+ portions: Save $3". These labels are display-only — no actual price reduction is applied to the cart subtotal.

> ⚠ See critical issue #30 — Volume pricing tiers are display-only. The cart total does not apply the discount. When wiring real pricing, either the API applies the discount server-side and returns an adjusted price, or the client must compute the discount before adding to cart.

> ⚠ See critical issue #29 — `buildCartLines` uses mock listing IDs (e.g., `"listing-1"`) which are not UUIDs. API UUID validation will reject all orders.

**`subscriptionEnabled` flow through to `CartItem.orderType`:**

1. Cook sets `subscriptionEnabled = true` on a listing (business dashboard).
2. Client sees the "Weekly subscriptions available" banner on the listing detail page.
3. The "Subscribe weekly" toggle appears in the order widget CTA area.
4. Selecting "Subscribe weekly" sets `subscribeMode = true`.
5. `buildCartLines()` produces items with `orderType: "subscription"`.
6. `CartContext.cartMode` computes to `"subscription"` (or `"mixed"` if there are also one-time items).
7. Checkout shows subscription consent checkboxes and `cartMode`-specific CTA copy.

**DB dependencies (when real API is wired):**
- `listings` — fetch by ID, including `subscriptionEnabled`, `minOrderQty`, `maxOrderQty`, `depositEnabled`.
- `listing_dishes` joined with `dishes` — fetch all dishes for the listing.
- `listing_promotions` — fetch active promotions for the deal callout.
- `listing_bundles` — fetch volume tiers for the policy card.
- `reviews` joined with `auth_user` — fetch reviews for this listing.

**Things to replace:**
- Replace `MOCK_LISTINGS.find(...)` with `GET /api/listings/:id`.
- Replace `MOCK_LISTING_REVIEWS[...]` with `GET /api/listings/:id/reviews`.
- Cover image `src="/placeholder.jpg"` → real `listing.coverPhotoUrl` (or a generated collage from dish photos).
- Cook avatar gradient → real cook profile photo or a consistent gradient derived from the cook ID.

**Ambiguities:**
- What happens to "Order once" vs "Subscribe weekly" when the listing has `subscriptionEnabled = false` but was previously in the cart as a subscription? This cannot happen with current flow (toggle only appears when `subscriptionEnabled`), but handle it defensively.

**Edge cases:**
- User adds listing to cart, navigates away, comes back: the `useEffect` that watches `items` re-syncs `quantities` and modes from the cart. The UI shows "In cart" banner.
- User adds a listing from one browser tab, then opens the same listing in another tab: both tabs have independent cart contexts (in-memory state). The second tab will show "add to cart" even though the first has it. The cart contexts will diverge. This is a known limitation of in-memory cart state and will be resolved when cart is persisted (localStorage or server-side).
- `listing.maxUnits` reached: the + button on all dishes becomes disabled (`atMaxUnits = true`). This enforces the per-order cap on the client side; the server must also enforce `maxOrderQty` on order creation.
- User opens DishModal and tries to add from there: `DishModal` calls `onAdd(dish)` which calls `handleAdd(dish)` — same quantity increment logic, same `maxUnits` check.

---

## Cook Profile (`/app/cooks/[id]`)

**Purpose:** Full cook profile page. Shows cook bio, stats, available listings, availability calendar, and reviews.

**Current behavior:**

Reads `params.id` and finds the cook in `MOCK_COOKS`. Filters `MOCK_LISTINGS` to `listing.cookId === cook.id`.

**Header card:**
- Large avatar (currently `<img src="/placeholder.jpg" />`) with cook display name and verified badge.
- "Follow" button: toggles `useState(false)` locally. Shows heart icon. "Following" state is purely in-memory — resets on every page load.
- Cuisine line: cuisine types + years experience.
- Rating row: aggregate rating, review count, neighborhood.
- Stats strip: ordersCompleted, yearsExperience, memberSince (year extracted from "Mar 2024" format).
- Availability block: day-of-week chip grid for pickup days and delivery days. Active days shown filled, inactive shown muted.

**Body:**
- Bio paragraph.
- Lead time badge (e.g., "Order 48h in advance").
- Available listings section: links to `/app/listings/:id` for each listing. Shows gradient cover, title, price-from, dish summary preview, dietary/niche badges, deal badge, spots left / sold out.
- Reviews section: shown only when `MOCK_REVIEWS[cook.id]` has entries. Each review shows reviewer avatar (initials), name, date, star rating, comment, dish name.

**Actionable elements:**
- Back button: `router.back()`.
- Follow button: `setFollowing(f => !f)` — local state only.
- Listing cards: navigate to `/app/listings/:id`.
- Cook avatar on listing cards: not interactive (navigates nowhere additional).

> ⚠ See critical issue #23 — Follow state resets on every page load. Needs `GET /api/follows/cooks` on mount + `POST`/`DELETE /api/follows/cooks/:id` toggle.

**Backend integration points:**
- `GET /api/cooks/:id` — cook profile data (bio, stats, availability days, verified status, cuisine types, rating, reviews).
- `GET /api/cooks/:id/listings` — active listings for this cook.
- `GET /api/cooks/:id/reviews` — paginated reviews.
- `GET /api/follows/cooks/:id` — check if current user follows this cook.
- `POST /api/follows/cooks/:id` — follow.
- `DELETE /api/follows/cooks/:id` — unfollow.

**DB dependencies:**
- `cook_profiles` (bio, stats, availability).
- `auth_user` (name, verified badge).
- `listings` (active listings for this cook).
- `reviews` + `auth_user` (reviewers).

**Things to replace:**
- Replace `MOCK_COOKS.find(...)` with API call.
- Replace `/placeholder.jpg` with real cook profile photo URL.
- Avatar gradient → real photo or consistent derived gradient.

**Ambiguities:**
- `cook.ordersCompleted` and `cook.memberSince` — where do these come from in DB? `cook_profiles` does not appear to have an `orders_completed` counter. Need to decide: aggregate from `orders` table at query time, or maintain a denormalized counter.
- Availability days (`pickupDays`, `deliveryDays`) — not in the current `cook_profiles` schema. Need to add or model as a separate `cook_availability` table.

**Edge cases:**
- Cook has no active listings: shows "No active listings right now." message.
- Cook has no reviews: reviews section is hidden entirely.
- Navigating to a non-existent cook ID with mock data: falls back to `MOCK_COOKS[0]` (Amara Diallo). With a real API, return a 404 and the page should render a not-found state.

---

## Cart (`/app/cart`)

**Purpose:** Review selected items before proceeding to checkout.

**Current behavior:**

If cart is empty, shows an empty state with "Browse listings" CTA.

Otherwise, renders a two-column layout (items left, order summary right on desktop; stacked on mobile).

**Items column:** Grouped by `listingId`. For each group:
- Header: thumbnail, listing title, cook name, fulfillment mode tag (Pickup / Delivery). "X" remove button calls `removeListing(listingId)`.
- Item list: `quantity × dishName` and `$price * quantity` for each dish.
- Weekly subscription notice: shown when `first.orderType === "subscription"`. Shows `WEEKLY_CHARGE_DISCLAIMER` (full text: "You'll be charged automatically every week until you unsubscribe. Cancel any time from Account → Subscriptions.").
- Listing subtotal.
- "Back to menu" link → `/app/listings/:id`.

**Order summary sidebar:**
- Subtotal (sum of all items).
- HST (Ontario 13%): `calcOntarioHst(total)` — computed client-side.
- Grand total.
- "Proceed to checkout" → `/app/checkout`.
- Promo code input + "Apply" button: the input is present but the Apply button has no handler. It does nothing.

> ⚠ See critical issue #10 — Tax is calculated client-side but the order API does not store or return a tax amount. The order total the user sees at cart and checkout will differ from what's recorded in the DB.
> ⚠ See critical issue #27 — Promo code Apply button has no handler. Needs `POST /api/promotions/validate` → returns discount amount → updates cart context.

**Tax calculation:** `app/app/cart/_cart-tax.ts` exports `calcOntarioHst(subtotal)` which applies 13% HST. `ONTARIO_HST_LABEL` = "HST (13%)". `formatCartMoney(amount)` formats to 2 decimal places.

**Backend integration points:**
- Promo code Apply: `POST /api/promotions/validate` with `{ code, listingIds }` → returns `{ discountAmount, promotionId }`. The `promotionId` must then be passed to `POST /api/orders` at checkout.
- Cart state: currently in-memory. If you want cart persistence across sessions, add a `POST /api/cart/sync` endpoint or use localStorage.

**DB dependencies (for promo):** `listing_promotions` — validate by code, check `isActive`, `validFrom`, `validUntil`, `maxUses`, `usesCount`.

**Ambiguities:**
- Does the promo code apply per-listing or to the whole cart? The API `POST /api/orders` accepts `promotionId` per order (i.e., per listing/cook group). So one promo code applies to one listing. The UI currently shows a single global promo code field — this needs product clarification.

**Edge cases:**
- User has items from multiple listings in different subscription/one-time modes: the cart shows all of them, each with its own subscription notice if applicable.
- User removes all items: cart empties and shows the empty state.
- Cart page accessed with an empty cart from a URL bookmark: shows empty state with "Browse listings".

---

## Checkout (`/app/checkout`)

**Purpose:** Multi-step payment flow. Converts cart contents into confirmed orders.

**Current behavior:**

Wrapped in `<Suspense>` (for `useSearchParams`). Reads the cart from `useCart()` and login state from `useApp()`. If the cart is empty and not mid-placing and not post-order, immediately redirects to `/app/cart`.

**Step count:**
- Logged-in user: 2 steps (Details → Payment)
- Guest user: 3 steps (Details → Account → Payment)

Navigation state is managed by `useState<CheckoutStep>`. The step can be pre-set via `?step=` query param (used by the login redirect `next` flow).

**`cartMode` and `isSubscriptionCart`:**

`cartMode` is computed by `CartContext` from the cart contents:
- `"one-time"`: all items have `orderType === "one_time"`
- `"subscription"`: all items have `orderType === "subscription"`
- `"mixed"`: both types present

`isSubscriptionCart = cartMode === "subscription" || cartMode === "mixed"`.

`isSubscriptionCart` blocks guest checkout entirely: `allowGuestCheckout = !isSubscriptionCart`.

### Step 1 — Contact & Fulfillment

**Contact section:**
- Logged-in: read-only summary pulled from `GET /api/auth/get-session`. Shows name (firstName + lastName), email, phone (if set).
- Guest: editable form (firstName, lastName, email, phone). Validates: all fields required, email format, phone required "for order updates".

**Delivery address section** (only shown when `needsDeliveryAddress === true`, i.e., any cart item has `fulfillmentMode === "delivery"`):
- Logged-in with saved address (`address.street` set) and not editing: read-only summary + "Edit address" button.
- Logged-in saved address is currently **hardcoded** to `{ street: "123 King St W", unit: "Apt 4B", city: "Toronto", province: "ON", postal: "M5H 1A1" }` in the `useEffect`. This is a placeholder until address book API exists.
- Guest or editing: full editable form (street, unit, city, postal — province hardcoded to "ON").
- When editing is active, "Save" button cancels edit mode (just closes the edit form, address remains in state — not saved to DB).

> ⚠ See critical issue #5 — Delivery address is collected but never sent to `POST /api/orders`. The `createOrderSchema` has no `deliveryAddress` field and the `orders` table has no `delivery_address` column.

**Fulfillment details section:** Read-only listing of each cook group showing cook name, listing title, fulfillment mode, and pickup date. Shows "Exact time confirmed after order." — this is the placeholder for the missing `pickupAt` value.

> ⚠ See critical issue #20 — `pickupAt` is required by `POST /api/orders` but is never collected or sent from checkout. Every real order attempt will return a 400 validation error.

**Validation:** `validateDetails()` skips contact validation for logged-in users (contact is read-only). Validates address fields if `needsDeliveryAddress`. On success, navigates to "account" (guest) or "payment" (logged-in).

### Step 2 — Account (guest flow)

Only shown when `!isLoggedIn`. Skipped entirely for logged-in users.

**Options presented:**
- "Continue as guest" (only shown when `allowGuestCheckout === true`, i.e., no subscription items): sets `checkoutMode = "guest"` and moves to payment.
- "Sign in" → `/app-auth/login?next=/app/checkout?step=payment` (for logged-in → skip account step).
- "Create an account" → `/app-auth/signup?next=/app/checkout?step=payment`.

When `isSubscriptionCart === true`, "Continue as guest" is replaced by a lock notice: "Subscriptions require an account to manage billing, pause, or cancel recurring charges."

> ⚠ See critical issue #19 — Guest checkout is fundamentally broken with the real API. `POST /api/orders` calls `auth.api.getSession()` and returns 401 if no session. The guest confirmation flow is entirely broken. Decision needed: remove guest checkout entirely, or implement a guest session/token system.

### Step 3 — Payment

**Guest banner:** If checking out as guest, shows "Checking out as guest · Sign in instead" at the top.

**Payment section (logged-in):**
Calls `GET /api/checkout/payment-methods` on mount (when `isLoggedIn && step === "payment"`). This is the only real API call in the current checkout flow.

- If the API returns cards: shows them as selectable rows with brand, last4, expiry. Selects the first card by default.
- If the API returns no cards (or the fetch fails): falls back to showing 2 **mock** saved cards (`pm_mock_visa` / `pm_mock_mc`). This means even in production, if the user has no Stripe payment methods, they see fake cards. This is a bug.
- "Add a new card" row: expands an inline form with card number, expiry, CVV raw inputs. Selecting "Add a new card" shows this inline form.

**Payment section (guest):** Full CC form (card number, expiry, CVV) directly.

> ⚠ See critical issue #4 — Raw card inputs are NOT passed to Stripe. When "Add a new card" (or guest CC form) is used, `paymentMethodId = "pm_mock_new_card"` is hardcoded. Stripe will reject this. Real Stripe.js `createPaymentMethod()` must be called with a `CardElement` before calling the order API.

**Subscription consent section** (shown when `isSubscriptionCart`):
One checkbox per distinct subscription listing ID in the cart. Each checkbox shows: "I authorize 7eats to charge my card **$X.XX every week** for **[Listing Title]** until I unsubscribe. [WEEKLY_CHARGE_DISCLAIMER]".

The per-subscription total includes HST: `calcOntarioHst(listingTotal) + listingTotal`.

`allConsentGiven = subscriptionListingIds.every(id => subscriptionConsent[id] === true)`. The "Place order" button is disabled until all boxes are checked (when `isSubscriptionCart`).

**Place order button CTA copy (`placeCTACopy`):**
| `cartMode` | `placing` | Label |
|---|---|---|
| `"one-time"` | false | `Pay · $X.XX` |
| `"subscription"` | false | `Subscribe · $X.XX` |
| `"mixed"` | false | `Pay & Subscribe · $X.XX` |
| `"subscription"` | true | `Subscribing…` |
| `"mixed"` | true | `Processing…` |
| any | true | `Paying…` |

**`handlePlaceOrder()`:**
1. Validates payment form.
2. Checks `allConsentGiven` (for subscription carts).
3. Sets `placing = true`.
4. **Currently:** `paymentMethodId = selectedCardId !== "new" ? selectedCardId : "pm_mock_new_card"` — hardcoded mock.
5. Builds `orderEntries` from `grouped` (one per cook group) with mock `orderId` and `pickupCode`.
6. Logs what it **would** send to the API but does NOT call `POST /api/orders`.
7. Awaits a 1-second artificial delay.
8. If new card was used: mock-adds it to `savedCards` and clears raw inputs.
9. Sets `ordered = true`, calls `clearCart()`.
10. Encodes order entries as URL params and navigates to `/app/checkout/confirmation?...`.

**Order summary sidebar:** Shows all cart items grouped by listing, subtotal, HST, grand total. For subscriptions/mixed carts, shows "Total today" label instead of "Total". Shows "Subscription items charge your card every week automatically" note for non-one-time carts.

**Backend integration points (all currently mocked):**
- Before calling orders API: tokenize card via `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)` + `stripe.createPaymentMethod({ type: "card", card: cardElement })`.
- For subscriptions: use `SetupIntent` flow — `POST /api/checkout/setup-intent` → get `clientSecret` → `stripe.confirmCardSetup(clientSecret, { payment_method: { card: cardElement } })` → use resulting `setupIntent.payment_method` as `paymentMethodId`.
- Per cook group: `POST /api/orders` with `{ listingId, quantity, paymentMethodId, pickupAt, promotionId?, notes? }`.
- Handle partial failure (some cook groups' orders succeed, others fail): cancel already-created PaymentIntents before surfacing error.

> ⚠ See critical issues #4, #5, #6, #7, #19, #20

**DB dependencies:**
- `orders` (insert), `order_dishes` (insert), `order_payments` (insert).
- `listings` (validate active, type, price, qty limits).
- `listing_promotions` (validate and decrement `usesCount`).
- `auth_user` (get/create Stripe customer ID).
- `cook_profiles` (get `stripeAccountId`, `platformFeePct`).

---

### Confirmation (`/app/checkout/confirmation`)

**Purpose:** Post-order success page. Decodes order data from URL query params and displays it.

**Current behavior:**

Reads `count`, `oidN`, `pcN`, `cookN`, `modeN`, `subN` from query params. If `count === 0`, redirects to `/app/cart` (direct navigation guard). Also reads `guest=1` and `email` for guest flow.

For each order entry, shows: cook name, fulfillment mode, "Weekly" badge if subscription, last portion of order ID as a reference code.

**Subscription section** (when any order `hasSubscription`):
- "Weekly subscription active" header.
- Next 4 weekly charge dates (computed from `Date.now()` + 7 * (i+1) days).
- "Cancel any time from **Account → Subscriptions**."
- Notification reminder banner: "You'll receive a reminder notification before each weekly [delivery/pickup]."
- FTC legal disclosure.

**Guest section:** Shows "Create an account" CTA → `/app-auth/signup` and "Continue browsing" → `/app/browse`.

**Logged-in section:** Shows "View your orders" → `/app/orders` and "Continue browsing" → `/app/browse`.

> ⚠ See critical issue #7 — The pickup code shown on the current mock is passed through URL params (`pcN`). In the real flow, the API only exposes `pickupCode` when `order.status === "ready"`. The confirmation page shows a code immediately after order placement. This code should be removed from the confirmation page — the code will appear on the order detail page when the cook marks the order ready.

> ⚠ See critical issue #11 — "Cancel any time from Account → Subscriptions" references a settings tab that does not yet exist. See also Settings > Subscriptions tab.

**Things to replace:** Once real API calls are in place, the confirmation page should receive real order IDs from the API response (not URL-encoded from the client). The current URL-param approach encodes mock data client-side. With real orders, redirect to `/app/checkout/confirmation?orderId=<uuid>` and fetch order details from `GET /api/orders/:id` on page load.

**Edge cases:**
- User manually navigates to `/app/checkout/confirmation` without having completed checkout: `count === 0` → redirect to `/app/cart`.
- User refreshes the confirmation page: URL params persist, page re-renders correctly.

---

## Orders (`/app/orders`)

**Purpose:** List of all orders for the logged-in client. Split into "Active" (pending/confirmed/ready) and "Past orders" (fulfilled/cancelled).

**Current behavior:**

Reads from `MOCK_ORDERS`. Filters:
- Active: `["pending", "confirmed", "ready"]`
- Past: `["fulfilled", "cancelled"]`

**Order card** (active): gradient cover, cook name, listing title, "Delivery/Pickup · date · window", subscription tag (if `order.isSubscription`), status badge, total.

Status badge labels:
| Status | Label |
|---|---|
| `"pending"` | "Pending" |
| `"confirmed"` | "Preparing" |
| `"ready"` | "Out for delivery" or "Ready for pickup" (by `fulfillmentMode`) |
| `"fulfilled"` | "Delivered" or "Picked up" |
| `"cancelled"` | "Cancelled" |

**Order card** (past): same structure but cover has `opacity: 0.6`. Shows "Order again" → `/app/listings/:listingId`.

**Empty state:** Icon + "No orders yet" + "Browse listings" CTA.

**`?success` query param:** If present in URL, shows a success banner: "Your order has been placed. Your cook will confirm pickup details shortly." This param is never currently set by the checkout flow (checkout redirects to `/confirmation` instead), but it exists as a fallback.

> ⚠ See critical issue #1 — Mock uses `"completed"` but DB enum uses `"fulfilled"`. The `past` filter `["fulfilled", "cancelled"]` is correct for the DB, but mock order `order-2` has `status: "fulfilled"` already. However, the status tracker in the detail page still uses `status === "completed"` in some legacy check. Check the detail page carefully.

> ⚠ See critical issue #2 — `"pending"` status is in the active filter (correct), but the status tracker in the order detail page has no "Awaiting confirmation" step.

> ⚠ See critical issue #8 — Real `GET /api/orders` returns `{ listingTitle, quantity, unitPrice, totalPrice, currency, pickupAt, notes, createdAt, pickupCode, dishes[] }`. It does NOT return `cookName`, `cookInitials`, `listingGradient`, `pickupWindow`. The orders list page will have no cook name or gradient for the cover color. The API must be extended.

> ⚠ See critical issue #33 — `pickupDate` and `pickupWindow` on mock orders are pre-formatted strings like `"Sat Jun 6"` and `"12pm – 5pm"`. The real API returns `pickupAt` as an ISO timestamp. A client-side formatter is needed.

**Backend integration points:**
- Replace `MOCK_ORDERS` with `GET /api/orders` calls.
- Extend the API response to include `cookName`, `cookId` (for avatar initials), `listingGradient` (or use a listing thumbnail), `pickupWindow` (formatted from `pickupAt` and a configurable window duration).
- Add pagination — there could be many past orders.

---

## Order Detail (`/app/orders/[id]`)

**Purpose:** Full detail view of a single order. Shows status tracker, fulfillment info, items/totals, pickup code, and review functionality.

**Current behavior:**

Reads `params.id` and finds the order in `MOCK_ORDERS`. Falls back to `MOCK_ORDERS[0]` if not found.

**Header card:** Full-width gradient banner with cook initials and name, listing title.

**Message CTA:** "Message [cook name]" → `/app/inbox`. Shown only when `!isCancelled && !isDone`.

**Code card** (shown when `!isCancelled`):
- Label: "Your pickup/delivery code" (or "Weekly pickup/delivery code · date" for subscriptions).
- Code display: `order.pickupCode` (currently mock string like "7E-4829").
- Description: "Show this code to [cook] when you arrive" / "Share this code when your order arrives."
- "Copy code" button: `navigator.clipboard.writeText(order.pickupCode)` with 2-second "Copied!" feedback.
- For subscriptions: "Your code renews automatically each week."

> ⚠ See critical issue #7 (again, from detail side) — `pickupCode` from the DB is only exposed via the GET orders API when `status === "ready"`. The current mock always shows the code. With real data, the code card should only render when `order.status === "ready"` (or `"fulfilled"` if you want to show the used code).

**Status tracker** (shown when `!isCancelled`):

For regular orders, 4 steps:
1. "Order placed" (always done)
2. "Cook is preparing" (done when `status` ∈ `{confirmed, ready, fulfilled}`)
3. "Out for delivery" / "Ready for pickup" (done when `status` ∈ `{ready, fulfilled}`)
4. "Delivered" / "Picked up" (done when `status === "fulfilled"`)

For subscription orders, Step 1 changes to "Auto-confirmed · [pickupDate]" (always done).

Each step shows a filled circle + checkmark (done) or clock icon (pending), with a vertical line connector.

> ⚠ See critical issue #2 — No "Awaiting confirmation" / "Pending" step in the tracker. New orders created via API start as `"pending"`. The tracker will show Step 1 as done (order placed) but Step 2 as pending, with no visual distinction between "pending" and "confirmed" states.

> ⚠ See critical issue #28 — Cancelled orders: `isCancelled = order.status === "cancelled"`. The code card, status tracker, and message CTA are all hidden. The order header and items card still show. There is no visual "cancelled" banner or explanation. A cancellation reason or cancelled-at timestamp should be shown.

**Review section** (shown when `isDone = order.status === "fulfilled"`):
- If no review: "Leave a review" button → opens `ReviewModal`.
- If review exists: shows star rating, Edit button, Delete button (Trash icon). Edit → opens modal with current rating/comment pre-filled. Delete → `setReview(null)`.

The `ReviewModal` shows:
- Cook name (eyebrow) + listing title.
- 5-star interactive hover/click rating.
- Rating label: Poor / Fair / Good / Great / Excellent! (index 1–5).
- Textarea for comment.
- Cancel / Submit (or "Update review").
- On `onSave(rating, comment)`: sets local `review` state only. No API call.

> ⚠ See critical issue #24 — Review submission has no handler and no API. The review is saved to `useState` only — resets on every page load. DB table `reviews` exists (see `db/schema/orders.ts`) but no client API routes are wired.

**Review API that needs to be built:**
```
POST /api/orders/:orderId/reviews
  Body: { rating: 1–5, comment?: string }
  Requires: session, order.status === "fulfilled", order.clientId === session.user.id
  DB: INSERT INTO reviews (orderId, clientId, cookId, listingId, rating, comment)
  Constraint: one review per order (unique on orderId)

PATCH /api/orders/:orderId/reviews
  Body: { rating?: 1–5, comment?: string }

DELETE /api/orders/:orderId/reviews
```

**Fulfillment details card:** Shows date/time (`pickupDate · pickupWindow`), location/address (`pickupAddress`), cook name.

> ⚠ See critical issue #25 — `order.pickupAddress` is displayed but the `orders` DB table has no `pickup_address` column. This address needs to either come from the cook profile (for pickup) or from the delivery address collected at checkout (for delivery). See also critical issue #5.

**Items card:** Lists all dishes with quantity × name and price. Totals breakdown: subtotal, service fee, total.

> ⚠ See critical issue #9 — `order.serviceFee` is shown (e.g., "$3.00") but the DB has no `service_fee` column and the API does not return it. The orders API has a `platformFeeAmount` (cook-facing) in `order_payments`, but this is not exposed to clients. Decision needed: show no service fee, add a consumer-facing fee, or rename platform fee.

**Backend integration points:**
- Replace `MOCK_ORDERS.find(...)` with `GET /api/orders/:id`.
- Extend API response to include cook name, listing gradient (or thumbnail), formatted pickup date/window, pickup address, service fee (or remove it).
- Wire review CRUD to DB.

---

## Favourites (`/app/saved`)

**Purpose:** Saved listings and followed cooks for a logged-in user.

**Current behavior:**

Two tabs: "Listings" and "Cooks". Tab buttons show count badges.

**Initial state:** Hardcoded seeds — `savedListings = new Set(["listing-1", "listing-3"])`, `savedCooks = new Set(["cook-1", "cook-4"])`.

**Listings tab:** Grid of listing cards identical in structure to Browse/Search cards (deal badge, stock pill, fulfillment pill, heart button always filled/active, title, rating, cook first name, distance, price-from, subscribe hint, schedule line).

Clicking the heart calls `unsaveListing(id)` which removes from the set. The listing disappears from the grid immediately.

**Cooks tab:** List of cook cards showing avatar (gradient + initials), cook name, cuisine/neighborhood, rating. Clicking the card link navigates to `/app/cooks/:id`. Bookmark icon button calls `unsaveCook(id)`.

**Empty states:** "No favourite listings / Tap the heart on any listing to save it here." and "No followed cooks / Follow your favourite cooks to keep up when they post new listings."

> ⚠ See critical issue #12 — All favourite state is in `useState`. No DB table, no API. State resets on every page load. When a user saves a listing on Browse, it is saved to Browse's own local `saved` state — these two states are completely independent. There is no shared source of truth.

**Backend integration points:**
- On mount: `GET /api/favourites/listings` and `GET /api/favourites/cooks` → populate initial sets.
- Unsave listing: `DELETE /api/favourites/listings/:id`.
- Unsave cook: `DELETE /api/favourites/cooks/:id` (or follows-style: `DELETE /api/follows/cooks/:id`).
- Save from Browse/Search/Listing detail: `POST /api/favourites/listings/:id`.
- Follow from Cook Profile: `POST /api/follows/cooks/:id`.

**DB dependencies:** New tables required:
- `saved_listings (userId text, listingId uuid)` — unique on (userId, listingId)
- `followed_cooks (userId text, cookId uuid)` — unique on (userId, cookId)

**Edge cases:**
- Saved listing's cook becomes unavailable or the listing expires: the listing still appears in Favourites. Need a filter for `listing.status === "active"` in the API response.
- User unsaves a listing in one tab while viewing it in another: both tabs have independent state. The unsave in tab A will not update tab B until refresh.

---

## Inbox (`/app/inbox`)

**Purpose:** Messaging between clients and cooks, threaded by order.

**Current behavior:**

Split-panel layout: thread list on the left (hidden on mobile when a thread is selected), chat panel on the right.

**Thread list:** Renders `MOCK_MESSAGE_THREADS` from `useState`. Each thread shows cook avatar (gradient + initials), cook name, timestamp, preview (last message text), unread dot. Clicking a thread calls `handleSelect(thread)` which opens the chat panel and marks the thread as `unread: false`.

**Chat panel:**
- Header: back button (mobile), cook avatar, cook name, "Cook · Active recently" status (hardcoded), order chip if `thread.orderId` is set.
- **Order chip:** Fetches the linked order from `MOCK_ORDERS.find(o => o.id === thread.orderId)`. Shows a gradient thumbnail, "View order" text, chevron. Links to `/app/orders/:orderId`. The chip's appearance changes based on `order.listingGradient`. When `thread.orderCompleted === true`, the composer is hidden and shows "Messaging is unavailable for this order."
- Messages: client messages are right-aligned (`bubbleClient`), cook messages are left-aligned with avatar (`bubbleCook`).
- Composer: text input + send button. On send or Enter key: appends new message to thread's `messages` array and updates the thread preview. All local state only.

**Unread count:** Header badge shows count of `threads.filter(t => t.unread).length`.

> ⚠ See critical issue #13 — Inbox is 100% mock. No API calls. The `messaging` schema exists in DB (`db/schema/messaging.ts`) but zero client routes are wired.

**Backend integration points:**
```
GET /api/inbox                           → list conversation threads (most-recent-first)
GET /api/inbox/:conversationId/messages  → paginated messages
POST /api/inbox/:conversationId/messages → send a message { text }
PATCH /api/inbox/:conversationId/read    → mark as read
```

The order chip needs `GET /api/orders/:id` (or embedded in the thread response as a `linkedOrder` object).

**DB dependencies:** `messaging` schema (conversations, messages tables).

**The `orderCompleted` flag:** The current mock sets `orderCompleted: true` when the linked order is `"fulfilled"` or `"cancelled"`. This should be derived server-side from `order.status` and returned in the thread response. When `orderCompleted === true`, the composer is hidden and shows a closed-order notice.

**Edge cases:**
- Cook sends a message after order is fulfilled: the composer on the client side is closed, but the cook can still send from their side. The client thread should still show new incoming messages even when `orderCompleted`, but the composer should remain closed.
- Unread badge across page navigation: currently resets to 0 after opening a thread (local state). With a real API, mark-as-read should be sent and the count persisted server-side.
- Two tabs open: sending a message in one tab won't update the other. With a real backend, WebSocket or polling would be needed for real-time updates.

---

## Settings (`/app/settings`)

**Purpose:** Account management: profile, preferences, payment methods, subscriptions, notification preferences.

**Current behavior:**

Five tabs: Profile, Preferences, Payment, Subscriptions, Notifications. All state is local — nothing persists across page loads.

### Profile Tab

**Personal info card:**
- View mode: shows firstName, lastName, phone, neighbourhood, dateOfBirth (formatted as "March 14, 1995").
- Edit mode: editable fields for firstName, lastName, phone, neighbourhood. dateOfBirth is NOT editable (intentionally — you cannot change your age after onboarding).
- "Save changes" calls `setProfile(profileDraft)` — local state only, no API call.
- "Cancel" reverts draft to current profile.

> ⚠ See critical issue #15 — `neighbourhood` has no column in `authUser`. The field is displayed and editable but cannot be persisted. Decision: add `neighborhood varchar(100)` to `authUser` or remove the field.

**Email card:** Read-only email display. Note: "To change your email address, contact support." Email changes are not self-service.

**Password card:** Two inputs (current password, new password). "Update password" button — no handler. No validation, no confirm-password field.

> ⚠ See critical issue #35 — Password change has no handler, no API call, and no confirm-password field. Needs `POST /api/auth/change-password` with `{ currentPassword, newPassword, confirmPassword }` and proper validation.

**Delete account card:** "Delete" button — no handler. Shows warning copy.

**Backend integration points:**
- `PATCH /api/user/profile` with `{ firstName, lastName, phone, neighborhood }`.
- `POST /api/auth/change-password` with `{ currentPassword, newPassword }` (use Better Auth's password update method).
- `DELETE /api/user/account` (with confirmation step — see edge case E1 in `pre-backend-critical-issues.md`).

**DB tables written:** `user.first_name`, `user.last_name`, `user.phone`, `user.neighborhood` (if added).

---

### Preferences Tab

**Current behavior:** Shows 4 preference questions from `PREFERENCE_QUESTIONS` (`_mock.ts`). Keys: `dietary`, `allergies`, `goals`, `whyMealPrep`. These exactly match the DB schema for `userPreferences`. Default answers are: `dietary: ["Halal"]`, `goals: ["High protein", "Comfort food"]`, `whyMealPrep: ["Save time cooking"]`.

Each question card has an "Edit" / "Done" toggle. When editing, options appear as chip buttons. Selecting toggles the answer in/out of the array. For `whyMealPrep` (`multiSelect: false`), only one option can be selected at a time.

"Save preferences" button calls `POST /api/auth/complete-onboarding` with the current `prefAnswers`. This is the same endpoint as onboarding Step 2 (which upserts `userPreferences`). This is intentional — the endpoint is a simple upsert.

> ⚠ The old Settings page bug (critical issue #14) was that keys used `diet`/`spice`/`group`/`cuisine`/`frequency` which didn't match DB. This has been fixed in the current code — `PREFERENCE_QUESTIONS` now uses `dietary`/`allergies`/`goals`/`whyMealPrep`. The "Save preferences" call now correctly posts to `complete-onboarding`. However, the save button currently silently calls the endpoint without any success/error feedback to the user. Add a toast or inline confirmation.

**DB tables written:** `user_preferences` (upsert via `complete-onboarding`).

---

### Payment Tab

**Current behavior:** List of saved cards (`MOCK_CARDS`), add card modal, set-default action, delete-with-confirmation flow.

**Card list:** Each card row shows brand, last4, expiry. Default card has a checkmark. "Set default" button for non-default cards. Delete (Trash) button triggers inline confirmation row ("Remove Visa ···· 4242? / Keep / Remove").

**Add card modal (`AddCardModal`):**
- Card number input: auto-formats to groups of 4 (`formatCardNumber`). Detects brand live (Visa/Mastercard/Amex/Discover) using prefix regex once 4+ digits entered. Shows "{Brand} detected" below input.
- Expiry input: auto-formats as MM/YY.
- CVV input: numeric only, 3–4 chars.
- Validation on submit:
  - Luhn check on card number (`luhnCheck`).
  - Expiry format (`/^\d{2}\/\d{2}$/`) + month range (1–12) + not expired (compares to current month/year).
  - CVV not empty, ≥ 3 chars.
- On valid submit: calls `onSave({ brand, last4, expMonth, expYear })` → added to `cards` state. New card gets `isDefault: true` only if there are no other cards.

> ⚠ See critical issue #4 — Raw card inputs in the Add Card modal are temporary until Stripe Elements are integrated. The Luhn validation and brand detection are client-side helpers that will be replaced by Stripe's `CardElement` which handles all this internally.

**Backend integration points:**
- Replace Add Card modal with Stripe Elements `CardElement` / `PaymentElement`.
- `POST /api/payment-methods` → create a Stripe `SetupIntent`, confirm with `stripe.confirmCardSetup()`, attach payment method to Stripe customer.
- `DELETE /api/payment-methods/:pmId` → detach from Stripe customer + remove from Stripe.
- `PATCH /api/payment-methods/:pmId/default` → update default payment method on Stripe customer.
- On mount: `GET /api/checkout/payment-methods` (already built) to load real cards.

**DB dependencies:** `user.stripe_customer_id` (read to find the Stripe customer).

**Edge cases:**
- Delete the only card while an active subscription exists: Stripe will fail to charge on the next billing cycle. The UI should warn: "You have an active subscription — removing this card may interrupt future payments."
- Delete the default card when multiple cards exist: current `removeCard` implementation promotes the first remaining card to default.

---

### Subscriptions Tab

**Purpose:** Manage active weekly subscriptions. Cancel subscriptions with a grace-period-aware guard.

**Current behavior:** Shows `MOCK_SUBS`. One mock subscription: Korean Banchan Box / Ji-won Park / Weekly / $26 / next charge Fri Jun 13 / current fulfillment Fri Jun 6.

**Active subscription card:**
- Top: listing title, cook name, status badge ("Active" / "Cancelled"), price/week.
- Footer: "Next charge · Fri Jun 13" with refresh icon (when active) OR "Cancelled · Last order: [currentFulfillmentDate]" (when cancelled).
- "Cancel" button → sets `confirmCancelSubId = sub.id` → shows the cancellation guard inline.

**Cancellation guard:**
- "Cancel this subscription?" header.
- Policy text: "Your **[currentFulfillmentDate]** order is already confirmed and will still be fulfilled. No further charges after cancellation."
- "Keep" → dismisses guard.
- "Confirm cancellation" → `confirmCancelSub(sub.id)` → sets `sub.status = "cancelled"` in local state.

**The `currentFulfillmentDate` vs `nextDate` distinction:**
- `nextDate` = the next billing charge date (the cook has not started preparing yet).
- `currentFulfillmentDate` = the upcoming delivery/pickup that has already been charged and is in progress.
- Cancellation takes effect after `currentFulfillmentDate` is fulfilled. The user still receives this week's meal.

> ⚠ See critical issue #11 — This tab now exists in the UI. The "Account → Subscriptions" references in checkout and confirmation pages now point to a real tab. However, no API routes exist to load or cancel subscriptions.

**Backend integration points:**
- `GET /api/subscriptions` → list `clientSubscriptions` for the current user. Response should include `listingTitle`, `cookName`, `interval` (always "weekly"), `price`, `nextDate` (ISO), `currentFulfillmentDate` (ISO), `status`.
- `POST /api/subscriptions/:id/cancel` → cancel the subscription. Effect: stops future charges after current billing cycle. The current `order` for this cycle should remain as-is.

**DB dependencies:** `client_subscriptions` table (in `db/schema/subscriptions.ts` — not read in this guide but exists).

**Ambiguities:**
- Can a subscription be paused (not just cancelled)? The UI has no pause button, only cancel. Decide before building the API.
- Reactivation: once cancelled, can the user restart the subscription from this tab? Currently no UI for it.

---

### Notifications Tab

**Current behavior:** Four notification toggles:
- `new_listing`: "New listings from saved cooks" — `true` by default
- `order_updates`: "Order updates" — `true` by default
- `messages`: "Messages" — `true` by default
- `marketing`: "Tips & updates" — `false` by default

Two channel toggles (SMS, Email). At least one channel must remain enabled — toggling the last active channel is disabled with `wouldDisableLast` logic.

All toggles update local `useState` only. No API call.

> ⚠ See critical issue #16 — Notification preferences are not persisted. Need a DB store and a PATCH endpoint.

**Backend integration points:**
- `PATCH /api/user/notifications` with `{ notifs: { new_listing, order_updates, messages, marketing }, channels: { sms, email } }`.

**DB dependencies:** New column or table needed. Options:
- `user.notification_preferences jsonb` column on `authUser`
- Separate `user_notification_prefs` table

---

## Subscription System (Cross-Cutting)

The subscription feature threads through multiple pages and components. Here is the complete data flow:

### Cook side: enabling subscriptions on a listing

The business dashboard listing detail context (`app/business/(dashboard)/listings/[id]/_listing-detail-context.tsx`) has a `subscriptionEnabled` toggle. When the cook sets this to `true` and saves, `listings.subscription_enabled = true` in the DB.

> ⚠ See critical issue #36 — The PATCH for listing edit does not include `subscriptionEnabled` in its payload. This means the toggle on the business side cannot actually be persisted.

### Client side: the subscription flow

1. **Browse/Search:** If `listing.subscriptionEnabled === true`, a subscribe hint (`<RefreshCw>` icon + "Subscribe") appears below the listing title meta line. This is purely informational.

2. **Listing Detail:** If `subscriptionEnabled === true`, a banner appears: "Weekly subscriptions available." The order widget shows a two-button toggle "Order once / Subscribe weekly" (visible when `!isInCart || isModifying`). Selecting "Subscribe weekly" sets `subscribeMode = true` and shows the weekly charge note.

3. **`buildCartLines()`:** When `subscribeMode === true`, sets `CartItem.orderType = "subscription"`. When false, sets `CartItem.orderType = "one_time"`.

4. **CartContext:** Computes `cartMode`:
   - `"one-time"`: all items have `orderType === "one_time"`
   - `"subscription"`: all items have `orderType === "subscription"`
   - `"mixed"`: both present
   
   `cartMode` is the primary driver of the checkout payment flow.

5. **Cart page:** Shows `WEEKLY_CHARGE_DISCLAIMER` notice for each subscription listing group.

6. **Checkout:**
   - `isSubscriptionCart = cartMode === "subscription" || cartMode === "mixed"`.
   - Guest checkout blocked when `isSubscriptionCart`.
   - Payment step shows consent checkboxes per subscription listing.
   - CTA copy varies by `cartMode`.
   - Summary sidebar shows "Total today" and recurring charge note for non-one-time carts.

7. **Confirmation:** Shows upcoming charge dates, FTC disclosure, "Cancel from Account → Subscriptions" message.

8. **Settings → Subscriptions tab:** Lists active subscriptions with cancellation guard.

**The `"one-time"` vs `"one_time"` problem (critical issue #3 — detail):**

`CartItem.orderType` in `_mock.ts` is declared as `"one_time" | "subscription"` (underscore). The `buildCartLines()` function produces `"one_time"` (underscore). The `cartMode` computation in `CartContext` checks `types.has("one_time")` (underscore). The comment in `CartContext` clarifies: "cartMode uses hyphen for UI (not sent to API)."

However, `cartMode` itself uses `"one-time"` (hyphen) in its type and CTA copy. This is correct — `cartMode` is a UI-only computed value, not sent to the API. The per-item `orderType` sent to the API via `CartItem` correctly uses `"one_time"` (underscore). This has been resolved relative to the original issue description.

**The `isSubscriptionCart` gate for guest checkout:**

When the user adds a subscription item and tries to check out without an account:
1. `isSubscriptionCart = true`
2. `allowGuestCheckout = false`
3. Step 2 (account) shows a lock notice instead of the guest option.
4. A guard in `useEffect` redirects from `?step=payment` back to `?step=account` if `!isLoggedIn && isSubscriptionCart`.

---

## Key Data Types

### `CartItem`

```typescript
type CartItem = {
  dishId: string;          // dish ID (mock: "dish-1-1")
  dishName: string;
  dishEmoji: string;
  listingId: string;       // listing ID — must be UUID for API. See critical issue #21
  listingTitle: string;
  orderType: "one_time" | "subscription";  // underscore (not hyphen)
  fulfillmentMode: "pickup" | "delivery";  // resolved (never "both")
  cookId: string;
  cookName: string;
  cookInitials: string;    // mock-only: "AD", "JP", etc.
  cookGradient: string;    // mock-only: CSS gradient string
  price: number;           // dish base price in dollars (integer)
  quantity: number;
};
```

`CartItem` is the atomic unit of cart state. One `CartItem` per dish per listing. Multiple dishes from the same listing create multiple `CartItem` rows with the same `listingId`. The cart groups by `listingId` for display.

`cookGradient` and `cookInitials` are mock-only. When real API data is used, these should either come from the listing/cook API response or be derived (initials from name, gradient from a hash of the cook ID).

### `CartMode`

```typescript
type CartMode = "one-time" | "subscription" | "mixed";
```

Note: uses hyphen in `CartMode` type and UI copy, but the underlying `CartItem.orderType` uses underscore. `CartMode` is never sent to the API.

### `MockOrder`

```typescript
type MockOrder = {
  id: string;
  cookId: string;
  listingId: string;
  cookName: string;
  cookInitials: string;    // mock-only
  listingTitle: string;
  listingGradient: string; // mock-only CSS gradient
  listingEmoji: string;    // mock-only
  pickupDate: string;      // pre-formatted "Sat Jun 6" — real API returns ISO timestamp
  pickupWindow: string;    // pre-formatted "12pm – 5pm" — real API returns nothing
  fulfillmentMode: "pickup" | "delivery";
  isSubscription?: boolean;
  dishes: { name: string; quantity: number; price: number }[];
  subtotal: number;
  serviceFee: number;      // mock-only: no DB column
  total: number;
  status: OrderStatus;     // "pending" | "confirmed" | "ready" | "fulfilled" | "cancelled"
  pickupCode: string;      // real API only exposes when status === "ready"
  pickupAddress: string;   // mock-only: no DB column
};
```

See critical issues #1, #8, #9, #25 for the discrepancies between `MockOrder` and what the real API returns.

### `OrderStatus`

```typescript
type OrderStatus = "pending" | "confirmed" | "ready" | "fulfilled" | "cancelled";
```

This matches the DB `order_status` enum exactly. The mock previously used `"completed"` — that has been corrected to `"fulfilled"` in `_mock.ts`. However, the legacy check in the order detail tracker still uses `status === "completed"` in one place — verify and fix before going live.

### `MockListing`

```typescript
type MockListing = {
  id: string;              // mock: "listing-1". Must be UUID for API. See critical issue #21
  cookId: string;
  title: string;
  description: string;
  gradient: string;        // mock-only CSS gradient
  image: string;           // always "/placeholder.jpg"
  emoji: string;           // mock-only
  pickupDate: string;      // pre-formatted "Sat Jun 6"
  pickupDateFull: string;  // pre-formatted "Saturday, June 6th"
  pickupWindow: string;    // pre-formatted "12pm – 5pm"
  orderDeadline: string;   // display: "Thu Jun 4, 11:59pm" or "Today" / "Tomorrow"
  orderDeadlineShort: string;
  orderDeadlineIso: string; // ISO timestamp for deadline comparison
  maxOrders: number;
  ordersLeft: number;
  dishes: MockDish[];
  cuisineTypes: CuisineType[];
  priceFrom: number;
  orderType: "one-time" | "subscription";  // listing's base type (hyphen format, mock-only)
  subscriptionEnabled: boolean;            // key field: drives subscribe-weekly toggle
  fulfillment: "pickup" | "delivery" | "both";
  deal: MockListingDeal | null;
  distanceKm: number;      // mock-only: Google Maps Distance Matrix replaces this
  isNew: boolean;          // for browse "New on 7eats" carousel
  isSpotlight: boolean;    // for browse "Spotlight" carousel
  isHighProtein: boolean;  // for browse "High protein" carousel
  niches: NicheCategory[];
  minUnits?: number;
  maxUnits?: number;
  priceTiers?: Array<{ minUnits: number; savingsLabel: string }>;
};
```

### `MockMessageThread`

```typescript
type MockMessageThread = {
  id: string;
  cookId: string;
  cookName: string;
  cookInitials: string;    // mock-only
  cookGradient: string;    // mock-only
  preview: string;
  timestamp: string;       // mock: "2h ago" — real API should return ISO or relative
  unread: boolean;
  orderCompleted?: boolean; // hides composer when true
  orderId?: string;         // links to order chip in chat header
  messages: { id: string; from: "client" | "cook"; text: string; timestamp: string }[];
};
```

### `PreferenceQuestion`

```typescript
type PreferenceQuestion = {
  id: string;       // "dietary" | "allergies" | "goals" | "whyMealPrep" — matches DB columns
  question: string;
  options: string[];
  multiSelect: boolean;
};
```

The `PREFERENCE_QUESTIONS` array in `_mock.ts` now exactly matches the `userPreferences` DB schema column names. Both onboarding and settings use these same question definitions.

---

## Cross-Reference Table: Critical Issues by Page

| Issue # | Severity | Page(s) |
|---|---|---|
| #1 `"completed"` vs `"fulfilled"` | CRITICAL | Orders list, Order detail |
| #2 `"pending"` not displayed | CRITICAL | Orders list, Order detail |
| #3 `"one-time"` vs `"one_time"` | CRITICAL | Listing detail, Cart context, Search filter |
| #4 Stripe tokenization mocked | CRITICAL | Checkout payment step, Settings payment tab |
| #5 Delivery address not sent to API | CRITICAL | Checkout step 1 |
| #6 Fulfillment mode not persisted | CRITICAL | Checkout, API orders |
| #7 pickupCode on confirmation | CRITICAL | Checkout confirmation, Order detail |
| #8 GET /api/orders missing fields | CRITICAL | Orders list |
| #9 serviceFee no DB column | CRITICAL | Order detail |
| #10 Tax calculated client-side only | CRITICAL | Cart, Checkout, Order detail |
| #11 Subscriptions tab missing | CRITICAL | Checkout, Confirmation, Settings |
| #12 No persistence for favourites | CRITICAL | Browse, Search, Saved |
| #13 Inbox 100% mock | CRITICAL | Inbox |
| #14 Preferences schema mismatch | CRITICAL | Settings preferences (now fixed in code) |
| #15 `neighborhood` no DB column | CRITICAL | Settings profile |
| #16 Notifications not persisted | CRITICAL | Settings notifications |
| #19 Guest checkout API 401 | CRITICAL | Checkout account step |
| #20 `pickupAt` never sent | CRITICAL | Checkout |
| #21 Mock IDs not UUIDs | CRITICAL | All pages that call orders API |
| #23 Follow state resets | HIGH | Cook profile |
| #24 Review has no API | HIGH | Order detail |
| #25 `pickupAddress` no DB column | HIGH | Order detail |
| #27 `promotionId` never sent | HIGH | Cart, Checkout |
| #28 Cancelled order no visual | HIGH | Order detail |
| #29 `buildCartLines` UUID fail | HIGH | Listing detail |
| #30 Volume tiers display-only | MEDIUM | Listing detail |
| #31 Tax client-side | MEDIUM | Cart |
| #32 `cookGradient`/initials mock-only | MEDIUM | Orders list |
| #33 Pre-formatted date strings | MEDIUM | Orders list |
| #34 `currencyCode` hardcoded CAD | MEDIUM | Checkout, Cart |
| #35 Password change no validation | MEDIUM | Settings profile |
| #36 subscriptionEnabled not patched | MEDIUM | Business listing edit (affects client) |
