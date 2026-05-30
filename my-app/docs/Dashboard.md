# 7eats — Business Dashboard

This document describes the structure and layout of the cook operator dashboard. It covers the shell, navigation, and page routing. Section-specific content is defined separately. This document is the source of truth for dashboard layout and navigation behavior.

---

## Current State

The dashboard shell is built and functional: header, left nav, main frame layout, mobile nav, profile dropdown, setup banner, and stub pages for all sections. The settings page is accessible from the profile dropdown and hides the left nav with a back link to the dashboard.

Active work: **Listings section** — schema is live (dishes, listings, listing_dishes, listing_promotions, order_dishes tables), frontend and API not yet built.

---

## Tech Stack

- Framework: Next.js 16 App Router with TypeScript
- Database: Neon (PostgreSQL) via Drizzle ORM
- Auth: Neon Auth (session-based)
- Styling: CSS Modules

---

## Route Group

The dashboard lives inside the `(business)` route group. All routes in this section require a valid cook session. No session redirects to `/business-auth/login`.

```
/business/dashboard        — default landing, overview
/business/orders           — incoming and historical orders
/business/listings         — listing management
/business/earnings         — revenue and payouts
/business/calendar         — pickup availability management
/business/inbox            — messages and conversations
/business/settings         — account and platform settings (TBD)
```

---

## Layout Structure

The dashboard shell is a three-region layout with no footer. It applies to every route under `/business/*` except the auth and onboarding routes which have their own minimal layout.

```
+--------------------------------------------------+
|                    HEADER                        |
+------------+-------------------------------------+
|            |                                     |
| LEFT PANEL |           MAIN FRAME                |
|            |                                     |
|            |                                     |
+------------+-------------------------------------+
```

The header spans the full width of the viewport. The left panel is fixed width and full height below the header. The main frame fills the remaining space to the right of the left panel and is the only scrollable region.

---

## Header

The header is a full-width fixed bar that sits at the top of every dashboard page. It does not scroll with the page content.

**Left side**
The 7eats logo. Clicking it always navigates to `/business/dashboard` regardless of which section is currently active.

**Right side — left to right order**
A help button — either a question mark icon or a button labeled Help. Purpose and content TBD.

A notification bell icon. Clicking it opens a dropdown or panel showing recent platform notifications. Badge appears when there are unread notifications.

An inbox icon. Clicking it navigates to `/business/inbox`. Badge appears when there are unread messages.

A profile picture button. Clicking it opens a small dropdown menu containing three items in this order: the cook's display name and email shown as non-interactive general info at the top, a Settings link navigating to `/business/settings`, and a Logout action that ends the session and redirects to `/business-auth/login`.

---

## Left Panel

The left panel is a fixed-width vertical navigation bar that remains visible on all dashboard pages. It does not scroll independently.

**Navigation items in order:**
- Dashboard — links to `/business/dashboard`
- Orders — links to `/business/orders`
- Listings — links to `/business/listings`
- Earnings — links to `/business/earnings`
- Calendar — links to `/business/calendar`
- Inbox — links to `/business/inbox`

**Active state**
The currently active navigation item is visually distinguished from inactive items. The active state is determined by matching the current URL pathname to the item's route. Navigating to any sub-route of a section — for example `/business/orders/[id]` — keeps the Orders item active.

**Default state**
The Dashboard item is active by default when the cook lands on `/business/dashboard`. No item is pre-selected in an expanded or hover state — the panel renders in its resting state on every load.

**Mobile behavior**
On mobile viewports the left panel collapses. Navigation is accessible via a hamburger icon in the header that opens the panel as an overlay. The main frame fills the full viewport width when the panel is collapsed.

---

## Main Frame

The main frame is the content region to the right of the left panel. It renders the page corresponding to the active left panel item. It is the only scrollable region in the layout — the header and left panel remain fixed as the main frame content scrolls.

The main frame has consistent internal padding on all sides. The content inside it is defined per section and documented separately.

**Default route**
Navigating to `/business` without a sub-path redirects to `/business/dashboard`.

**404 behavior**
Navigating to a `/business/*` path that does not exist renders a not-found state inside the main frame. The header and left panel remain visible and functional.

---

## Middleware Behavior

Auth middleware runs before every page load under `/business/*` and enforces the following:

- No valid cook session redirects to `/business-auth/login`
- A cook with an incomplete setup can access all dashboard routes. A persistent banner in the main frame indicates which setup steps are outstanding. Listings created before setup is complete are saved as drafts and cannot be published until all steps are done
- A cook with a complete setup has full access to all sections with no restrictions

---

## Settings Page

`/business/settings` is accessible from the profile dropdown in the header. Content and structure are TBD and will be defined in a separate document.

---

## Full Shell at a Glance

```
Header
  Left:   7eats logo → /business/dashboard
  Right:  Help | Notification bell | Inbox icon | Profile picture dropdown
            Profile dropdown:
              [Display name + email — non-interactive]
              Settings → /business/settings
              Logout → ends session → /business-auth/login

Left Panel
  Dashboard   → /business/dashboard       (default, active on load)
  Orders      → /business/orders
  Listings    → /business/listings
  Earnings    → /business/earnings
  Calendar    → /business/calendar
  Inbox       → /business/inbox

Main Frame
  Renders the active section
  Only scrollable region
  Consistent internal padding
  Incomplete setup: persistent banner with outstanding steps
  Unknown route: not-found state, shell remains intact
```

---

## Listings Section

### Overview

The listings section has three levels: **Dishes**, **Listings**, and **Promotions**. Dishes are the atomic units (a specific meal a cook makes). Listings are bundles of dishes sold together at a price. Promotions are deals attached to a specific listing.

Listings are set to `active` on creation for now. The `pending_review` status exists in the schema and can be enforced later without a migration.

---

### Frontend — Functional Guidelines

**Dishes**
- Cooks can create dishes independently of any listing. A dish not attached to any listing stays in the dashboard but is never visible publicly.
- A dish has: name, description, cuisine (free text), categories (multi-select from predefined slugs), dietary flags (halal, vegan, vegetarian, gluten-free, dairy-free, nut-free, kosher), serving size, status.
- Each dish can have photos (upload, reorder, set primary), ingredients (name, quantity, allergen flag), and nutrition info (calories, protein, carbs, fat, etc.).
- Dishes cannot be deleted. To remove a dish from circulation, the cook archives it. Archived dishes disappear from listing composition pickers.
- Tags can be attached to a dish and removed.

**Listings**
- A listing is built by selecting existing dishes and specifying how many of each are included.
- Each listing has: title, description, base price, currency, optional cover photo (if none, UI generates a collage from dish photos), min and max order quantity.
- The composition of a listing (which dishes, how many) can be changed only when the listing has no active or pending orders. The API enforces this — the frontend should surface a clear message when the block is in effect.
- A listing can be archived by the cook. Archived listings are no longer visible to clients.

**Promotions**
- A promotion is attached to a specific listing.
- Three types: percentage off (1–100%), fixed amount off, buy X get Y free.
- Each promotion has optional validity window (start date, end date) and optional max redemption cap.
- Cooks can toggle a promotion active/inactive without deleting it.
- `uses_count` is read-only on the frontend — it is incremented server-side on order placement.

---

### API Design — Listings Section

The following CRUD actions need to be supported. Exact route shape and request/response format are flexible — this is a reference for what the frontend will need to call.

#### Dishes

| Action | Notes |
|--------|-------|
| List dishes | Returns all dishes for the authenticated cook, with status filter |
| Get dish | Single dish with photos, ingredients, nutrition, tags |
| Create dish | Core fields only; photos/ingredients added separately |
| Update dish | Any subset of core fields |
| Archive dish | Status transition to `archived`; no hard delete |
| Add photo | Upload URL handling via R2; store URL + metadata |
| Reorder / set primary photo | Update sort order and primary flag |
| Delete photo | Remove a single photo |
| Add ingredient | Append to dish ingredients |
| Update ingredient | Edit name, quantity, allergen flag |
| Delete ingredient | Remove a single ingredient |
| Upsert nutrition | Create or update the nutrition row for a dish (one-to-one) |
| Add tag | Attach a tag to a dish |
| Remove tag | Detach a tag from a dish |

#### Listings

| Action | Notes |
|--------|-------|
| List listings | Returns all listings for the cook, with optional status filter |
| Get listing | Single listing with its dish composition |
| Create listing | Creates with `active` status; composition added separately |
| Update listing | Title, description, price, cover photo, order qty bounds |
| Archive listing | Status transition to `archived` |
| Delete listing | Allowed only when status is `draft` |
| Add dish to listing | Append a dish with quantity and sort order |
| Update dish in listing | Change quantity or sort order of a dish in the composition |
| Remove dish from listing | Blocked if non-cancelled orders exist for this listing |

#### Promotions

| Action | Notes |
|--------|-------|
| List promotions | All promotions for a given listing |
| Create promotion | Type, value, buy/get qty, dates, max uses, minimum order qty |
| Update promotion | Any field except `uses_count` |
| Toggle active | Convenience update for `is_active` flag |
| Delete promotion | Hard delete; safe because orders snapshot the discount at placement |

---

## Frontend Design Plan

Requirements gathered per page. Milestones are frontend-only (no backend work). Each milestone produces a shippable, visually complete page or feature. Order follows logical dependency — detail pages come after list pages, creation flows after detail pages.

---

### M1 — Dashboard Home (`/business/dashboard`)

**Layout**
Two-zone stacked layout. Stats row across the top, order queue below it filling the remaining space.

**Stats row**
Four cards in a horizontal row (2×2 grid on mobile):
- Earnings this week / this month (toggle between the two)
- Pending orders (count of orders needing action)
- Active listings (count)
- Rating (average star + total review count)

**Order queue**
Unconfirmed/pending orders pinned to the top of the queue, visually separated from confirmed/ready orders below. Each row shows: listing title, customer name, pickup time, quantity, total price, and a primary action button (e.g. "Confirm"). Clicking a row navigates to `/business/orders` with that order focused.

No activity feed. No review section. The home page is purely operational.

---

### M2 — Orders (`/business/orders`, `/business/orders/[id]`)

**Desktop layout — two-column**
Left column (~380px, fixed): scrollable order list. Right column: detail panel for the focused order. Clicking an order in the list loads its detail on the right without navigation. Default state on first load: first unconfirmed order is focused (if any), otherwise first order in the list.

**Mobile layout**
Single-column order list. Tapping an order opens a slide-over from the right covering the full viewport. Close button returns to the list.

**Order list**
Unconfirmed/pending orders pinned to the top as a distinct group (e.g. "Needs action" section header). Below that: confirmed, ready, fulfilled, cancelled — all in one scrollable feed, newest first. Each row shows:
- Customer name + listing title
- Pickup time (relative: "Today 3pm", "Tomorrow 11am")
- Quantity + total price
- Status badge
- Primary inline action button for the next status step (Confirm → Mark Ready → [verify code on detail])

**Order detail panel / slide-over**
Full order information: listing title, customer name, pickup time, quantity, unit price, total, any notes. Dish breakdown (from order snapshot). Status action buttons (advance or cancel). Pickup code verification UI (6-digit input, attempt counter, lock state). Cancellation confirmation.

---

### M3 — Listing Detail (`/business/listings/[id]`)

**Layout**
Single-column page with four tabbed sections: Overview | Dishes | Deals | Orders.

**Overview tab**
Editable listing fields: title, description, base price, currency, cover photo (upload or collage preview), min/max order qty, status toggle (active / archived). Save button. Basic stats above the form: total orders, total revenue, average order value.

**Dishes tab**
Drag-to-reorder list of dishes in the listing. Each dish row shows name, cuisine, quantity in this listing, and a remove button. Remove is blocked (with explanation) when non-cancelled orders exist. "Add dish" button opens a picker of the cook's active dishes.

**Deals tab**
All promotions attached to this listing. Each deal row uses the same compact design as the Deals tab on the main listings page (bold discount + inline details). Active/inactive toggle per deal. "New Deal" button opens a creation form inline or as a slide-over. No delete if `uses_count > 0` — only deactivation allowed.

**Orders tab**
Paginated list of all orders for this listing (same row design as the Orders page), scoped to this listing only.

---

### M4 — Dish Detail (`/business/listings/dishes/[id]`)

**Layout**
Single-column page with three tabbed sections: Details | Nutrition & Ingredients | Stats.

**Details tab**
Editable fields: name, cuisine, description, photo (upload, up to 4 photos, set primary), categories (multi-select chips), dietary flags (toggle row), status toggle (active / archived). Save button.

**Nutrition & Ingredients tab**
Ingredients list (name, quantity, allergen flag). Add / edit / remove ingredients inline. Nutrition panel below: calories, protein, carbs, fat — all optional. Single save for the whole tab.

**Stats tab**
Shown only if the dish has order history. Displays: total times ordered, which listings it appears in (with links), order volume trend (simple bar or number — no chart library required if data is sparse).

---

### M5 — New Listing (`/business/listings/new`)

**Flow — full dedicated page, two steps**

Step 1 — Core info: title, description, base price, currency, min/max order qty, cover photo (optional). Continue button.

Step 2 — Dish composition: pick from active dishes, set quantity per dish, drag to reorder. Each dish shows name and cuisine. "No dishes yet" prompts to create one first. Finish → creates listing with `active` status, redirects to the listing detail page.

Back navigation between steps preserves entered values.

---

### M6 — New Dish (`/business/listings/dishes/new`)

**Flow — full dedicated page, two steps**

Step 1 — Core info: name, cuisine (free text), description, categories (multi-select), dietary flags (toggle row), status (active by default). Continue button.

Step 2 — Media & extras: photo upload (up to 4, drag to reorder, set primary). Optional: ingredients and nutrition info. These can be skipped and filled in later from the dish detail page. Finish → creates dish, redirects to dish detail.

---

### M7 — Earnings (`/business/earnings`)

**Layout**
Single page, top-to-bottom sections.

**Period summary**
Week / Month toggle at the top. Shows: gross revenue, platform fee (displayed as a line item, not hidden), net payout, order count for the period. Period navigation arrows to go back/forward.

**Breakdown by listing**
Table or card list showing each listing's contribution in the selected period: listing title, order count, gross, net. Sorted by gross descending.

**Pending release**
A highlighted strip showing total money from confirmed/ready orders not yet paid out. Makes the "money in flight" concept visible.

**Payout history**
Paginated list of past Stripe payouts: date, amount, status (pending, in transit, paid, failed). Clicking a payout row shows its details.

---

### M8 — Calendar (`/business/calendar`)

**Layout**
Two views toggled at the top: **Calendar** and **Schedule**.

**Calendar view**
Monthly calendar grid. Days with pickup availability highlighted. Days with confirmed orders show a count badge. Clicking a day opens a side panel (desktop) or slide-over (mobile) showing: availability for that day (on/off, hours) and the list of orders due that day with their status and pickup time.

**Schedule view**
A list-style view of upcoming pickups and deliveries grouped by date. Each entry shows order details, customer name, pickup or delivery type, and status. Useful for planning without needing the calendar grid.

**Availability settings**
Accessible from a persistent "Manage Availability" button on both views. Opens a settings panel: pickup days (day-of-week toggles), pickup window (from/to time), lead time (same day / 1–5 days), max daily capacity, delivery mode (none / self). These map directly to `cook_profiles` fields.

---

### M9 — Inbox (`/business/inbox`)

**Layout — desktop**
Two-column: left is the conversation list, right is the open thread. Same pattern as Orders two-panel.

**Layout — mobile**
Conversation list → tap → full-screen thread with back button.

**Conversation list**
Each row: customer name, last message preview, timestamp, unread indicator. Conversations are only created when a customer has an active (non-cancelled) order with this cook.

**Thread view**
Chat-style message bubbles. Sticky header shows customer name + a link to their current order ("View order →"). Message input at the bottom. No attachments — text only.

---

### M10 — Settings (`/business/settings`)

**Layout**
Tabbed page. Tab nav on the left side (desktop) or horizontal scrollable tabs (mobile). Four tabs:

**Profile tab**
Display name, bio (textarea, 500 char limit), profile photo upload, social link. All fields from onboarding, editable here.

**Availability & Delivery tab**
Pickup address, pickup days, pickup window, lead time, max capacity, delivery mode (none / self), late cancel fee (toggle, type, value, window hours). Covers everything availability-related set during onboarding.

**Notifications tab**
Email toggles: new order, new review. SMS toggle: new order. Simple toggle rows with labels.

**Payouts tab**
Stripe Connect status card: shows whether charges and payouts are enabled, any outstanding requirements. Button to open Stripe Express Dashboard. Button to restart onboarding if requirements are pending.
