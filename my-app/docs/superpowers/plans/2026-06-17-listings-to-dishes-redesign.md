# Listings → Dishes Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove listings as a concept and make dishes the primary ordering unit — dishes carry their own price and promotions, cooks are the browse/order entry point, and subscriptions are dropped from all user-facing flows for launch.

**Architecture:** Three dependency-ordered phases. (1) Database: add `price` to dishes, order-rule columns to cook_profiles, a new `dish_promotions` table, and rewrite dish/order/review RLS off the listing join. (2) Backend API: relocate dish CRUD out from under listings, add dish-promotion CRUD, rewrite multi-dish order creation through service_role, and reshape cook browse/menu/order endpoints. (3) Frontend: cook-card browse, a new `/app/cooks/[id]/menu` ordering page, a multi-dish single-cook cart, a subscription-free checkout, and a business "Meals" dashboard with a promotions tab. Deprecated tables stay in the DB for order history; no new writes touch them.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript strict, Neon Postgres + Drizzle ORM with pgPolicy RLS, Better Auth, Stripe Connect/Elements, Zod validation, Vitest, Biome, Tailwind v4 + CSS Modules, pnpm.

**Spec:** `my-app/docs/superpowers/specs/2026-06-17-listings-to-dishes-redesign.md` — the authoritative field-level reference. This plan implements it; when in doubt, the spec wins.

**Conventions baked into every task:**
- All commands run from `my-app/`.
- **API security (every route):** `auth.api.getSession({ headers })` → 401 if absent; role check → 403; cook ownership via `getCookId(req.headers)`; Zod `safeParse` on every body → 400 on failure; financial writes only via service_role (`dbPool.transaction`); never trust client-supplied prices.
- **Naming:** dish name column is `dishes.name` (never `title`); user names use `firstName`/`lastName` or `cook_profiles.displayName` (never `authUser.name`).
- **UI consistency:** reuse `globals.css` tokens (`--ink`, `--white`, `--grey-*`, `--red`); no hardcoded hex; responsive to mobile; visible keyboard focus; respect `prefers-reduced-motion`. Follow existing CSS Module patterns in the file being replaced.
- **After any `db/schema/**` change:** `pnpm db:generate` then `pnpm exec drizzle-kit push` (load `DATABASE_URL` from `.env.local`, never print it).
- **Per-task gates:** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test:run` must pass before the task is done.

---

## File Structure

**Database (`my-app/db/schema/`)**
- `enums.ts` — modify: no new enum needed (`promotionType` reused); confirm only.
- `dishes.ts` — modify: add `price`, rewrite all public-select RLS, add `dish_promotions` table here (lives with dishes, changes together).
- `cooks.ts` — modify: add `minOrderQty`, `maxOrderQty`, `cancellationAllowed`; drop one check.
- `orders.ts` — modify: nullable `listingId`/`quantity`/`unitPrice`, drop FK + 2 checks, add `cancellationAllowed`, new `order_dishes` columns, reviews `listingId` nullable, rewrite RLS.

**Backend API (`my-app/app/api/`)**
- `business/_lib/cook-auth.ts` — create (moved from `business/listings/_lib/`).
- `business/dishes/**` — create (moved from `business/listings/dishes/**`), add `price`, drop `listingCount`.
- `business/dishes/[dishId]/promotions/**` — create: list/create/patch/delete/toggle.
- `business/dashboard/settings/route.ts` — modify: order-rule fields in/out.
- `cooks/route.ts` — modify: cook cards + distance.
- `cooks/[cookId]/route.ts` — modify: add order-rule fields.
- `cooks/[cookId]/menu/route.ts` — create.
- `cooks/[cookId]/reviews/route.ts` — modify: add `dishes[]`.
- `orders/route.ts` — modify: multi-dish create + list reshape.
- `orders/[orderId]/route.ts` — modify: detail reshape + cancellation.
- `orders/[orderId]/reviews/route.ts` — modify: drop listingId.
- Removed: `listings/**`, `business/listings/**` (non-dish), `favourites/listings/**`, `subscriptions/[subscriptionId]/**`.

**Frontend client (`my-app/app/app/`)**
- `_cart-context.tsx` — rewrite.
- `browse/page.tsx` — rewrite to cook cards.
- `cooks/[id]/menu/page.tsx` + `_DishModal.tsx` + `page.module.css` — create.
- `cooks/[id]/page.tsx` — modify.
- `search/page.tsx` — modify.
- `cart/page.tsx`, `checkout/page.tsx`, `checkout/_payment-form.tsx`, `orders/page.tsx`, `orders/[id]/page.tsx` — modify.
- Removed: `listings/[id]/**`, `subscriptions/page.tsx`; `saved/page.tsx` hidden.

**Frontend business (`my-app/app/business/(dashboard)/`)**
- `dishes/**` — created (moved from `listings/**` per spec relocation table).
- `dishes/[id]/page.tsx` — add Promotions tab.
- `dishes/new/page.tsx` — add price field.
- `settings/page.tsx` — order-rules section.
- `_shell.tsx` — nav rename.
- Removed: `listings/[id]/**`, `listings/new/**`.

**Routing**
- `proxy.ts` — modify route classification.

---

# PHASE 1 — Database Schema

### Task 1: Add `price` to dishes and rewrite dish RLS

**Files:**
- Modify: `my-app/db/schema/dishes.ts`

- [ ] **Step 1: Add the `price` column**

In `dishes.ts`, inside the `dishes` table column block, after `servingSize`, add:

```ts
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
```

Add a table-level check. The `dishes` table currently passes `() => [...]` with no `t` param — change the signature to `(t) => [` and add as the first array entry:

```ts
    check("dishes_price_positive", sql`${t.price} > 0`),
```

Ensure `check` and `numeric` are imported (both already imported in this file).

- [ ] **Step 2: Rewrite the public-visibility helpers**

Replace the `dishInActiveListing` and `dishChildInActiveListing` constants (lines ~27–45) with status-based versions:

```ts
// dish is publicly visible when it is active
const dishIsActive = sql`status = 'active'`;

// helper for child tables: parent dish is active
const dishChildOfActive = sql`dish_id IN (
  SELECT id FROM dishes WHERE status = 'active'
)`;
```

- [ ] **Step 3: Point dish + child policies at the new helpers**

In `dishes_select_public` change `using: dishInActiveListing` → `using: dishIsActive`.
In `dish_photos_select_public`, `dish_ingredients_select_public`, `dish_nutrition_select_public` change `using: dishChildInActiveListing` → `using: dishChildOfActive`.
In `dish_tags_select_public`, replace the inline `listing_dishes` subquery `using` with:

```ts
      using: sql`dish_id IN (
        SELECT id FROM dishes WHERE status = 'active'
      )`,
```

Update the stale comment above `status` (line ~74) to: `// Workflow status — also drives public visibility (active = visible).`

- [ ] **Step 4: Verify the listing import is gone**

There is no `listings`/`listing_dishes` import in `dishes.ts` (the helpers used raw SQL), so nothing to remove. Confirm with: `pnpm exec tsc --noEmit` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add my-app/db/schema/dishes.ts
git commit -m "feat(db): add dish price, switch dish visibility to status-based RLS"
```

---

### Task 2: Add `dish_promotions` table

**Files:**
- Modify: `my-app/db/schema/dishes.ts`

- [ ] **Step 1: Import the enum and `uniqueIndex`**

At the top of `dishes.ts`, add `promotionType` to the `./enums` import and ensure `uniqueIndex` is in the `drizzle-orm/pg-core` import:

```ts
import { dishStatus, promotionType } from "./enums";
```

(`uniqueIndex`, `boolean`, `integer`, `numeric`, `timestamp`, `check`, `pgPolicy`, `sql` already imported.)

- [ ] **Step 2: Append the table at the end of `dishes.ts`**

```ts
// ─── Dish Promotions ─────────────────────────────────────────────────────────
// One promotion per dish active at a time (partial unique index). The API
// enforces validUntil XOR maxUses; usesCount is incremented by service_role at
// order time. value is always required for both promo types.

export const dishPromotions = pgTable(
  "dish_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    type: promotionType("type").notNull(),
    // percentage_off: 1–100. fixed_off: positive dollar amount.
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    // null = unlimited; mutually exclusive with validUntil (enforced in API).
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // At most one active promotion per dish
    uniqueIndex("dish_promotions_one_active_uidx")
      .on(t.dishId)
      .where(sql`is_active = true`),
    check("dish_promo_value_positive", sql`${t.value} > 0`),
    check(
      "dish_promo_percentage_max",
      sql`${t.type} != 'percentage_off' OR ${t.value} <= 100`,
    ),
    check("dish_promo_max_uses_positive", sql`${t.maxUses} IS NULL OR ${t.maxUses} >= 1`),
    check("dish_promo_uses_count_non_negative", sql`${t.usesCount} >= 0`),
    check(
      "dish_promo_uses_count_cap",
      sql`${t.maxUses} IS NULL OR ${t.usesCount} <= ${t.maxUses}`,
    ),
    check(
      "dish_promo_dates_order",
      sql`${t.validFrom} IS NULL OR ${t.validUntil} IS NULL OR ${t.validUntil} > ${t.validFrom}`,
    ),
    pgPolicy("dish_promotions_select_public", {
      for: "select",
      to: "public",
      using: sql`
        is_active = TRUE
        AND dish_id IN (SELECT id FROM dishes WHERE status = 'active')
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
      `,
    }),
    pgPolicy("dish_promotions_select_own", {
      for: "select",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("dish_promotions_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("dish_promotions_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("dish_promotions_update_own", {
      for: "update",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
      withCheck: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("dish_promotions_update_service", {
      for: "update",
      to: "public",
      using: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("dish_promotions_delete_own", {
      for: "delete",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add my-app/db/schema/dishes.ts
git commit -m "feat(db): add dish_promotions table with one-active-per-dish index"
```

---

### Task 3: Cook order-rule + cancellation columns

**Files:**
- Modify: `my-app/db/schema/cooks.ts`

- [ ] **Step 1: Add columns**

In `cookProfiles`, after `acceptsSpecialRequests`, add:

```ts
    minOrderQty: integer("min_order_qty").notNull().default(1),
    maxOrderQty: integer("max_order_qty"),
    cancellationAllowed: boolean("cancellation_allowed").notNull().default(false),
```

- [ ] **Step 2: Add checks, drop the late-cancel-window check**

In the `(t) => [...]` block, add:

```ts
    check("cook_profiles_min_order_qty_positive", sql`${t.minOrderQty} >= 1`),
    check(
      "cook_profiles_max_order_qty_valid",
      sql`${t.maxOrderQty} IS NULL OR ${t.maxOrderQty} >= ${t.minOrderQty}`,
    ),
```

Delete the existing `cook_profiles_late_cancel_window_positive` check entry. Leave `lateCancelWindowHours` and the other `lateCancelFee*` columns in place (deprecated, unused).

- [ ] **Step 3: Type-check + commit**

Run: `pnpm exec tsc --noEmit` — Expected: PASS.

```bash
git add my-app/db/schema/cooks.ts
git commit -m "feat(db): add cook order rules and cancellation policy columns"
```

---

### Task 4: Orders/order_dishes/reviews schema changes

**Files:**
- Modify: `my-app/db/schema/orders.ts`

- [ ] **Step 1: Fix imports**

Replace the listings/subscriptions imports. Remove `listingPromotions, listings` from `./listings` and `clientSubscriptions` from `./subscriptions`. Keep `listings` only as a type-less FK target — but per spec `listingId` becomes a nullable set-null FK, so we still need the `listings` reference. Keep:

```ts
import { listings } from "./listings";
import { dishPromotions } from "./dishes";
```

Remove the `listingPromotions` and `clientSubscriptions` imports entirely.

- [ ] **Step 2: Loosen `orders` columns**

- `listingId`: change to nullable, set-null FK:

```ts
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
```

- `quantity`: remove `.notNull().default(1)` → `quantity: integer("quantity"),`
- `unitPrice`: remove `.notNull()` → `unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),`
- `promotionId`: drop the FK, keep a plain uuid:

```ts
    promotionId: uuid("promotion_id"),
```

- `subscriptionId`: drop the FK, keep a plain uuid (column retained for history):

```ts
    subscriptionId: uuid("subscription_id"),
```

- Add after `discountAmount`:

```ts
    cancellationAllowed: boolean("cancellation_allowed").notNull().default(false),
```

- [ ] **Step 3: Drop the two positivity checks + subscription unique index**

Remove `orders_quantity_positive` and `orders_unit_price_positive` check entries. Remove the `orders_subscription_period_uidx` unique index entry (it referenced the subscription flow that no longer writes). Keep `orders_discount_non_negative`, `orders_total_price_non_negative`, the pickup-code and fulfillment-mode checks.

- [ ] **Step 4: Rewrite `orders_insert_client` RLS**

Replace the entire `withCheck` body with:

```ts
      withCheck: sql`client_id = auth.uid() AND status = 'pending'`,
```

- [ ] **Step 5: Extend `order_dishes`**

Add columns after `dishName`:

```ts
    priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }).notNull(),
    promotionId: uuid("promotion_id").references(() => dishPromotions.id, {
      onDelete: "set null",
    }),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
```

Add checks to the `order_dishes` table block:

```ts
    check(
      "order_dishes_discount_non_negative",
      sql`${t.discountAmount} IS NULL OR ${t.discountAmount} >= 0`,
    ),
    check("order_dishes_line_total_non_negative", sql`${t.lineTotal} >= 0`),
```

- [ ] **Step 6: Make `reviews.listingId` nullable + rewrite insert RLS**

Change `listingId`:

```ts
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
```

In `reviews_insert_client`, remove the `AND o.listing_id = reviews.listing_id` line from the `withCheck` EXISTS clause. Leave the `UNIQUE(order_id)` on `orderId` intact (one review per order — intentional per spec).

- [ ] **Step 7: Type-check + commit**

Run: `pnpm exec tsc --noEmit` — Expected: PASS.

```bash
git add my-app/db/schema/orders.ts
git commit -m "feat(db): decouple orders/reviews from listings, add per-dish order pricing"
```

---

### Task 5: Generate and push the migration

**Files:**
- Create: `my-app/db/migrations/*` (generated)

- [ ] **Step 1: Generate**

Run: `pnpm db:generate`
Expected: a new migration file under `db/migrations/` capturing dish price, dish_promotions, cook columns, order/review changes. Review the SQL — confirm it adds (not drops) the deprecated columns and that the partial unique index `dish_promotions_one_active_uidx` is present.

- [ ] **Step 2: Push to Neon**

Run: `pnpm exec drizzle-kit push` (env from `.env.local`)
Expected: applies cleanly. If it warns about making `quantity`/`unitPrice` nullable on existing rows, accept — existing orders keep their values.

- [ ] **Step 3: Commit**

```bash
git add my-app/db/migrations
git commit -m "chore(db): generate listings-to-dishes migration"
```

---

# PHASE 2 — Backend API (Cook/Business side)

### Task 6: Relocate cook-auth helper

**Files:**
- Create: `my-app/app/api/business/_lib/cook-auth.ts`
- Modify: all importers (done incrementally in later tasks)

- [ ] **Step 1: Create the new helper**

Copy `business/listings/_lib/cook-auth.ts` verbatim to `business/_lib/cook-auth.ts` (content unchanged — it only imports `@/db`, `@/db/schema`, `@/lib/auth`).

- [ ] **Step 2: Keep the old path temporarily**

Leave `business/listings/_lib/cook-auth.ts` in place until all importers move (Task 13 deletes the listings tree). This avoids breaking imports mid-phase.

- [ ] **Step 3: Commit**

```bash
git add my-app/app/api/business/_lib/cook-auth.ts
git commit -m "chore(api): add relocated cook-auth helper"
```

---

### Task 7: Relocate dish CRUD routes

**Files:**
- Create: `my-app/app/api/business/dishes/route.ts`
- Create: `my-app/app/api/business/dishes/[dishId]/route.ts`
- Create: `my-app/app/api/business/dishes/[dishId]/archive/route.ts`
- Create: `my-app/app/api/business/dishes/[dishId]/{ingredients,nutrition,photos,tags}/**` (move all)
- Test: `my-app/__tests__/api/business/dishes/create.test.ts`

- [ ] **Step 1: Move the files**

Copy every file from `business/listings/dishes/**` to `business/dishes/**`, preserving subpaths. In each moved file, update the import:
`from "@/app/api/business/listings/_lib/cook-auth"` → `from "@/app/api/business/_lib/cook-auth"`.

- [ ] **Step 2: Add `price` to create/edit schemas**

In `business/dishes/route.ts` `createDishSchema`, add:

```ts
  price: z.number().positive().multipleOf(0.01),
```

Pass it through in the insert `.values({ cookId, ...parsed.data, status: "draft" })` (already spreads `parsed.data`). In `business/dishes/[dishId]/route.ts` PATCH schema, add the same `price` field as optional:

```ts
  price: z.number().positive().multipleOf(0.01).optional(),
```

- [ ] **Step 3: Drop the `listingCount` subquery**

In `business/dishes/route.ts` GET, replace the select that computes `listingCount` with a plain `db.select().from(dishes)`:

```ts
    const rows = await db
      .select()
      .from(dishes)
      .where(conditions)
      .orderBy(desc(dishes.createdAt));
```

Remove the now-unused `getTableColumns` and `sql` imports if no longer referenced.

- [ ] **Step 4: Write the failing test**

Create `__tests__/api/business/dishes/create.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirror of the route's createDishSchema price rule
const priceField = z.number().positive().multipleOf(0.01);

describe("dish price validation", () => {
  it("rejects zero and negative", () => {
    expect(priceField.safeParse(0).success).toBe(false);
    expect(priceField.safeParse(-5).success).toBe(false);
  });
  it("accepts a 2-decimal positive price", () => {
    expect(priceField.safeParse(12.5).success).toBe(true);
  });
});
```

- [ ] **Step 5: Run it**

Run: `pnpm test:run __tests__/api/business/dishes/create.test.ts`
Expected: PASS (validates the schema rule we added).

- [ ] **Step 6: Type-check + commit**

```bash
git add my-app/app/api/business/dishes my-app/__tests__/api/business/dishes
git commit -m "feat(api): relocate dish CRUD to /business/dishes with price"
```

---

### Task 8: Dish promotions — list + create

**Files:**
- Create: `my-app/app/api/business/dishes/[dishId]/promotions/route.ts`
- Test: `my-app/__tests__/api/business/dishes/promotions.test.ts`

- [ ] **Step 1: Write the failing validation test**

Create `__tests__/api/business/dishes/promotions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validatePromotionWindow } from "@/app/api/business/dishes/[dishId]/promotions/_validate";

describe("promotion validUntil XOR maxUses", () => {
  it("rejects when neither is set", () => {
    expect(validatePromotionWindow({}).ok).toBe(false);
  });
  it("rejects when both are set", () => {
    expect(
      validatePromotionWindow({ maxUses: 10, validUntil: "2030-01-01T00:00:00Z" }).ok,
    ).toBe(false);
  });
  it("accepts only maxUses", () => {
    expect(validatePromotionWindow({ maxUses: 10 }).ok).toBe(true);
  });
  it("accepts only validUntil in the future", () => {
    expect(
      validatePromotionWindow({ validUntil: "2999-01-01T00:00:00Z" }).ok,
    ).toBe(true);
  });
  it("rejects validUntil in the past", () => {
    expect(
      validatePromotionWindow({ validUntil: "2000-01-01T00:00:00Z" }).ok,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run it → fails (module missing)**

Run: `pnpm test:run __tests__/api/business/dishes/promotions.test.ts`
Expected: FAIL — cannot find `_validate`.

- [ ] **Step 3: Create the validator**

Create `business/dishes/[dishId]/promotions/_validate.ts`:

```ts
export type PromotionWindow = { maxUses?: number; validUntil?: string };

export function validatePromotionWindow(
  w: PromotionWindow,
): { ok: true } | { ok: false; error: string } {
  const hasMaxUses = w.maxUses !== undefined && w.maxUses !== null;
  const hasValidUntil = w.validUntil !== undefined && w.validUntil !== null;
  if (hasMaxUses === hasValidUntil) {
    return { ok: false, error: "Set exactly one of an end date or a max redemptions limit." };
  }
  if (hasValidUntil && new Date(w.validUntil as string) <= new Date()) {
    return { ok: false, error: "End date must be in the future." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run it → passes**

Run: `pnpm test:run __tests__/api/business/dishes/promotions.test.ts` — Expected: PASS.

- [ ] **Step 5: Write the route**

Create `business/dishes/[dishId]/promotions/route.ts`:

```ts
import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, notFound, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishPromotions, dishes } from "@/db/schema";
import { validatePromotionWindow } from "./_validate";

type Params = { params: Promise<{ dishId: string }> };

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("percentage_off"),
    value: z.number().min(1).max(100),
    maxUses: z.number().int().min(1).optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("fixed_off"),
    value: z.number().positive(),
    maxUses: z.number().int().min(1).optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
  }),
]);

async function ownDish(dishId: string, cookId: string) {
  const [d] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .limit(1);
  return d ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId } = await params;
  if (!(await ownDish(dishId, cookId))) return notFound("Dish");

  const rows = await db
    .select()
    .from(dishPromotions)
    .where(eq(dishPromotions.dishId, dishId))
    .orderBy(asc(dishPromotions.createdAt));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }
  const win = validatePromotionWindow({
    maxUses: parsed.data.maxUses,
    validUntil: parsed.data.validUntil,
  });
  if (!win.ok) return NextResponse.json({ error: win.error }, { status: 422 });

  if (!(await ownDish(dishId, cookId))) return notFound("Dish");

  try {
    // Deactivate any existing active promo before inserting the new active one
    const inserted = await db.transaction(async (tx) => {
      await tx
        .update(dishPromotions)
        .set({ isActive: false })
        .where(and(eq(dishPromotions.dishId, dishId), eq(dishPromotions.isActive, true)));
      const [row] = await tx
        .insert(dishPromotions)
        .values({
          dishId,
          type: parsed.data.type,
          value: String(parsed.data.value),
          isActive: true,
          ...(parsed.data.maxUses !== undefined ? { maxUses: parsed.data.maxUses } : {}),
          ...(parsed.data.validFrom ? { validFrom: new Date(parsed.data.validFrom) } : {}),
          ...(parsed.data.validUntil ? { validUntil: new Date(parsed.data.validUntil) } : {}),
        } as typeof dishPromotions.$inferInsert)
        .returning();
      return row;
    });
    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (err) {
    console.error("[dish-promotions POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Type-check + commit**

```bash
git add my-app/app/api/business/dishes/[dishId]/promotions my-app/__tests__/api/business/dishes/promotions.test.ts
git commit -m "feat(api): dish promotions list + create with XOR validation"
```

---

### Task 9: Dish promotions — patch, delete, toggle

**Files:**
- Create: `my-app/app/api/business/dishes/[dishId]/promotions/[promotionId]/route.ts`
- Create: `my-app/app/api/business/dishes/[dishId]/promotions/[promotionId]/toggle/route.ts`

- [ ] **Step 1: PATCH + DELETE route**

Create `.../promotions/[promotionId]/route.ts`. PATCH: validate ownership (dish belongs to cook AND promo belongs to dish), re-run `validatePromotionWindow` on the merged result, reject `maxUses < usesCount`, update. DELETE: load the promo; if `usesCount === 0` hard-delete, else set `isActive = false`.

```ts
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, notFound, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishPromotions, dishes } from "@/db/schema";
import { validatePromotionWindow } from "../_validate";

type Params = { params: Promise<{ dishId: string; promotionId: string }> };

const patchSchema = z.object({
  value: z.number().positive().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

async function loadOwned(dishId: string, promotionId: string, cookId: string) {
  const [row] = await db
    .select({
      id: dishPromotions.id,
      type: dishPromotions.type,
      maxUses: dishPromotions.maxUses,
      usesCount: dishPromotions.usesCount,
      validUntil: dishPromotions.validUntil,
    })
    .from(dishPromotions)
    .innerJoin(dishes, eq(dishPromotions.dishId, dishes.id))
    .where(
      and(
        eq(dishPromotions.id, promotionId),
        eq(dishPromotions.dishId, dishId),
        eq(dishes.cookId, cookId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId, promotionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const current = await loadOwned(dishId, promotionId, cookId);
  if (!current) return notFound("Promotion");

  const nextMaxUses =
    parsed.data.maxUses !== undefined ? parsed.data.maxUses : current.maxUses;
  const nextValidUntil =
    parsed.data.validUntil !== undefined
      ? parsed.data.validUntil
      : current.validUntil?.toISOString();

  const win = validatePromotionWindow({
    maxUses: nextMaxUses ?? undefined,
    validUntil: nextValidUntil ?? undefined,
  });
  if (!win.ok) return NextResponse.json({ error: win.error }, { status: 422 });
  if (nextMaxUses != null && nextMaxUses < current.usesCount) {
    return NextResponse.json(
      { error: "Max redemptions cannot be below current usage." },
      { status: 422 },
    );
  }
  if (
    parsed.data.value != null &&
    current.type === "percentage_off" &&
    parsed.data.value > 100
  ) {
    return NextResponse.json({ error: "Percentage cannot exceed 100." }, { status: 400 });
  }

  const [updated] = await db
    .update(dishPromotions)
    .set({
      ...(parsed.data.value != null ? { value: String(parsed.data.value) } : {}),
      maxUses: nextMaxUses ?? null,
      validUntil: nextValidUntil ? new Date(nextValidUntil) : null,
    })
    .where(eq(dishPromotions.id, promotionId))
    .returning();
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId, promotionId } = await params;

  const current = await loadOwned(dishId, promotionId, cookId);
  if (!current) return notFound("Promotion");

  if (current.usesCount === 0) {
    await db.delete(dishPromotions).where(eq(dishPromotions.id, promotionId));
    return NextResponse.json({ success: true, data: { deleted: true } });
  }
  await db
    .update(dishPromotions)
    .set({ isActive: false })
    .where(eq(dishPromotions.id, promotionId));
  return NextResponse.json({ success: true, data: { deleted: false, deactivated: true } });
}
```

- [ ] **Step 2: Toggle route**

Create `.../promotions/[promotionId]/toggle/route.ts`. On activate, deactivate other active promos for the dish first (inside a transaction) to respect the partial unique index.

```ts
import { and, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, notFound, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishPromotions, dishes } from "@/db/schema";

type Params = { params: Promise<{ dishId: string; promotionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();
  const { dishId, promotionId } = await params;

  const [row] = await db
    .select({ id: dishPromotions.id, isActive: dishPromotions.isActive })
    .from(dishPromotions)
    .innerJoin(dishes, eq(dishPromotions.dishId, dishes.id))
    .where(
      and(
        eq(dishPromotions.id, promotionId),
        eq(dishPromotions.dishId, dishId),
        eq(dishes.cookId, cookId),
      ),
    )
    .limit(1);
  if (!row) return notFound("Promotion");

  const next = !row.isActive;
  await db.transaction(async (tx) => {
    if (next) {
      await tx
        .update(dishPromotions)
        .set({ isActive: false })
        .where(and(eq(dishPromotions.dishId, dishId), ne(dishPromotions.id, promotionId)));
    }
    await tx
      .update(dishPromotions)
      .set({ isActive: next })
      .where(eq(dishPromotions.id, promotionId));
  });
  return NextResponse.json({ success: true, data: { isActive: next } });
}
```

- [ ] **Step 3: Type-check + commit**

```bash
git add my-app/app/api/business/dishes/[dishId]/promotions/[promotionId]
git commit -m "feat(api): dish promotion patch/delete/toggle"
```

---

### Task 10: Settings — order rules in, late-cancel out

**Files:**
- Modify: `my-app/app/api/business/dashboard/settings/route.ts`

- [ ] **Step 1: Swap the schema fields**

Replace `patchSchema` late-cancel fields with order-rule fields:

```ts
const patchSchema = z.object({
  acceptsSpecialRequests: z.boolean().optional(),
  minOrderQty: z.number().int().min(1).optional(),
  maxOrderQty: z.number().int().min(1).nullable().optional(),
  cancellationAllowed: z.boolean().optional(),
  emailNotificationsNewOrder: z.boolean().optional(),
  emailNotificationsNewReview: z.boolean().optional(),
  smsNotificationsNewOrder: z.boolean().optional(),
});
```

- [ ] **Step 2: Update `pickSettingsFields`**

```ts
function pickSettingsFields(row: typeof cookProfiles.$inferSelect) {
  return {
    acceptsSpecialRequests: row.acceptsSpecialRequests,
    minOrderQty: row.minOrderQty,
    maxOrderQty: row.maxOrderQty,
    cancellationAllowed: row.cancellationAllowed,
    emailNotificationsNewOrder: row.emailNotificationsNewOrder,
    emailNotificationsNewReview: row.emailNotificationsNewReview,
    smsNotificationsNewOrder: row.smsNotificationsNewOrder,
  };
}
```

- [ ] **Step 3: Cross-field guard**

After parse, before update, reject `maxOrderQty < minOrderQty` when both are present in the body (the DB check also guards this, but return a clean 400):

```ts
  if (
    body.minOrderQty != null &&
    body.maxOrderQty != null &&
    body.maxOrderQty < body.minOrderQty
  ) {
    return NextResponse.json(
      { error: "Max order quantity must be at least the minimum." },
      { status: 400 },
    );
  }
```

Update the import to the relocated `@/app/api/business/_lib/cook-auth`.

- [ ] **Step 4: Type-check + commit**

```bash
git add my-app/app/api/business/dashboard/settings/route.ts
git commit -m "feat(api): settings accept order rules, drop late-cancel fields"
```

---

# PHASE 3 — Backend API (Client side)

### Task 11: Cook browse + profile + reviews

**Files:**
- Modify: `my-app/app/api/cooks/route.ts`
- Modify: `my-app/app/api/cooks/[cookId]/route.ts`
- Modify: `my-app/app/api/cooks/[cookId]/reviews/route.ts`

- [ ] **Step 1: `GET /api/cooks` cook cards**

Rewrite the select to use `cook_profiles.displayName`, `photoUrl`, `bio`, `leadTime`, `delivery`, `pickupCity`, plus aggregate rating/reviewCount, and a representative active-dish photo via a correlated subquery. Accept optional `lat`/`lng` query params; when present, compute `distanceKm` with the haversine formula in SQL and order by it. Read params:

```ts
const url = new URL(req.url);
const lat = url.searchParams.get("lat");
const lng = url.searchParams.get("lng");
```

Representative photo subquery (correlated):

```ts
representativeDishPhoto: sql<string | null>`(
  SELECT dp.url FROM dish_photos dp
  JOIN dishes d ON d.id = dp.dish_id
  WHERE d.cook_id = ${cookProfiles.id} AND d.status = 'active'
  ORDER BY d.created_at ASC, dp.sort_order ASC
  LIMIT 1
)`,
```

When `lat`/`lng` are valid floats, add a `distanceKm` select expression and `.orderBy()` on it; otherwise return `distanceKm: null` and keep the existing order. Keep `setupComplete = true` filter. Change the function signature from `GET()` to `GET(req: Request)` so params are readable.

- [ ] **Step 2: `GET /api/cooks/[cookId]` add order rules**

Add `minOrderQty`, `maxOrderQty`, `cancellationAllowed`, and `displayName` to the select and the returned `data` object. Keep existing fields. (Profile remains reachable; this just adds policy info.)

- [ ] **Step 3: `GET /api/cooks/[cookId]/reviews` add `dishes[]`**

After fetching the review rows, fetch their order dish names in one query and attach as `dishes: string[]`:

```ts
const orderIds = reviews.map((r) => r.orderId);
const dishRows = orderIds.length
  ? await db
      .select({ orderId: orderDishes.orderId, name: orderDishes.dishName })
      .from(orderDishes)
      .where(inArray(orderDishes.orderId, orderIds))
  : [];
const byOrder: Record<string, string[]> = {};
for (const d of dishRows) (byOrder[d.orderId] ??= []).push(d.name);
// attach byOrder[r.orderId] ?? [] as `dishes` on each review
```

(Confirm the reviews query selects `orderId`; add it if missing.)

- [ ] **Step 4: Type-check + commit**

```bash
git add my-app/app/api/cooks
git commit -m "feat(api): cook cards, profile order-rules, dish-tagged reviews"
```

---

### Task 12: New `GET /api/cooks/[cookId]/menu`

**Files:**
- Create: `my-app/app/api/cooks/[cookId]/menu/route.ts`

- [ ] **Step 1: Write the route**

Return `cook` (with `displayName`, `photoUrl`, `bio`, `minOrderQty`, `maxOrderQty`, `leadTime`, `delivery`, `cancellationAllowed`, `pickupCity`, `pickupWindows`) and `dishes` (active only, with `name`, `description`, `price`, `photos`, `tags`, and the single active `promotion`). 404 when the cook profile is missing/inactive.

```ts
import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  authUser,
  cookPickupWindows,
  cookProfiles,
  dishPhotos,
  dishPromotions,
  dishTags,
  dishes,
  tags,
} from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const { cookId } = await params;
  try {
    const [cook] = await db
      .select({
        id: cookProfiles.id,
        displayName: cookProfiles.displayName,
        photoUrl: cookProfiles.photoUrl,
        bio: cookProfiles.bio,
        minOrderQty: cookProfiles.minOrderQty,
        maxOrderQty: cookProfiles.maxOrderQty,
        leadTime: cookProfiles.leadTime,
        delivery: cookProfiles.delivery,
        cancellationAllowed: cookProfiles.cancellationAllowed,
        pickupCity: cookProfiles.pickupCity,
      })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(and(eq(cookProfiles.id, cookId), eq(authUser.status, "active")))
      .limit(1);
    if (!cook) return NextResponse.json({ error: "Cook not found." }, { status: 404 });

    const windows = await db
      .select({
        dayOfWeek: cookPickupWindows.dayOfWeek,
        fromTime: cookPickupWindows.fromTime,
        toTime: cookPickupWindows.toTime,
      })
      .from(cookPickupWindows)
      .where(eq(cookPickupWindows.cookId, cookId));

    const dishRows = await db
      .select({
        id: dishes.id,
        name: dishes.name,
        description: dishes.description,
        price: dishes.price,
      })
      .from(dishes)
      .where(and(eq(dishes.cookId, cookId), eq(dishes.status, "active")))
      .orderBy(asc(dishes.createdAt));

    const dishIds = dishRows.map((d) => d.id);
    const [photos, tagRows, promos] = dishIds.length
      ? await Promise.all([
          db.select({ dishId: dishPhotos.dishId, url: dishPhotos.url, sortOrder: dishPhotos.sortOrder })
            .from(dishPhotos).where(inArrayHelper(dishPhotos.dishId, dishIds)),
          db.select({ dishId: dishTags.dishId, slug: tags.slug, label: tags.label })
            .from(dishTags).innerJoin(tags, eq(dishTags.tagId, tags.id))
            .where(inArrayHelper(dishTags.dishId, dishIds)),
          db.select().from(dishPromotions)
            .where(and(inArrayHelper(dishPromotions.dishId, dishIds), eq(dishPromotions.isActive, true))),
        ])
      : [[], [], []];

    // group + assemble (see note)
    // ...build dishes[] with photos, tags, and at most one promotion each
    return NextResponse.json({ success: true, data: { cook: { ...cook, pickupWindows: windows }, dishes: assembled } });
  } catch (err) {
    console.error("[cooks/menu]", err);
    return NextResponse.json({ error: "Failed to load menu." }, { status: 500 });
  }
}
```

Implementation notes for the assembler: import `inArray` from `drizzle-orm` (the `inArrayHelper` above is shorthand — use `inArray`); group photos/tags/promos by `dishId` into maps; for each dish attach `photos` (sorted by sortOrder), `tags`, and `promotion` = the single active promo row or `null` (the partial unique index guarantees ≤1). Only expose promo fields `id, type, value, validUntil, maxUses, usesCount`.

- [ ] **Step 2: Type-check + commit**

```bash
git add my-app/app/api/cooks/[cookId]/menu
git commit -m "feat(api): cook menu endpoint for the ordering page"
```

---

### Task 13: Rewrite order creation (multi-dish)

**Files:**
- Modify: `my-app/app/api/orders/route.ts`
- Test: `my-app/__tests__/api/orders/pricing.test.ts`

- [ ] **Step 1: Failing pricing test**

Create `__tests__/api/orders/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeLineTotal } from "@/lib/order-pricing";

describe("computeLineTotal", () => {
  it("no promo", () => {
    expect(computeLineTotal(10, 2, null)).toEqual({ discountAmount: 0, lineTotal: 20 });
  });
  it("percentage_off caps at line value", () => {
    expect(computeLineTotal(10, 2, { type: "percentage_off", value: 50 }))
      .toEqual({ discountAmount: 10, lineTotal: 10 });
  });
  it("fixed_off never goes negative", () => {
    expect(computeLineTotal(5, 1, { type: "fixed_off", value: 999 }))
      .toEqual({ discountAmount: 5, lineTotal: 0 });
  });
});
```

- [ ] **Step 2: Run → fails**

Run: `pnpm test:run __tests__/api/orders/pricing.test.ts` — Expected: FAIL.

- [ ] **Step 3: Create the pricing helper**

Create `my-app/lib/order-pricing.ts`:

```ts
export type PromoLike = { type: "percentage_off" | "fixed_off"; value: number };

export function computeLineTotal(
  price: number,
  quantity: number,
  promo: PromoLike | null,
): { discountAmount: number; lineTotal: number } {
  const gross = price * quantity;
  let discount = 0;
  if (promo) {
    discount =
      promo.type === "percentage_off"
        ? (gross * promo.value) / 100
        : promo.value;
    discount = Math.min(discount, gross);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { discountAmount: round(discount), lineTotal: round(gross - discount) };
}
```

- [ ] **Step 4: Run → passes**

Run: `pnpm test:run __tests__/api/orders/pricing.test.ts` — Expected: PASS.

- [ ] **Step 5: Rewrite the POST handler**

Replace `createOrderSchema` and the POST body. New schema:

```ts
const createOrderSchema = z.object({
  cookId: z.string().uuid(),
  dishes: z.array(z.object({
    dishId: z.string().uuid(),
    quantity: z.number().int().min(1),
    promotionId: z.string().uuid().nullable().optional(),
  })).min(1),
  paymentMethodId: z.string().min(1),
  pickupAt: z.string().datetime(),
  fulfillmentMode: z.enum(["pickup", "delivery"]).optional(),
  deliveryAddress: z.object({
    street: z.string().min(1).max(200),
    unit: z.string().max(50).optional(),
    city: z.string().min(1).max(100),
    province: z.string().length(2),
    postal: z.string().min(5).max(10),
  }).optional(),
  customerLat: z.number().min(-90).max(90).optional(),
  customerLng: z.number().min(-180).max(180).optional(),
  notes: z.string().max(500).optional(),
});
```

Handler logic (implement per spec §4.3, reusing existing helpers `calcDeliveryFee`, `getDrivingDistanceKm`, `createFullPaymentIntent`, `cancelPaymentIntent`, `getOrCreateStripeCustomer`):
1. Session + role `client`; onboarding check (keep existing).
2. Load cook (`status='active'` via authUser join): `minOrderQty`, `maxOrderQty`, `leadTime`, `cancellationAllowed`, `platformFeePct`, `stripeAccountId`, delivery fields. 404 if missing; 400 if no `stripeAccountId`.
3. Map `leadTime` → hours via `LEAD_TIME_HOURS` (define: `same_day:0, "1_day":24, ... "5_days":120`). Reject `new Date(pickupAt) < now + offset` → 400.
4. Sum quantities; enforce min/max → 400.
5. Load all requested dishes in one `inArray` query filtered to `cookId` + `status='active'`. If any requested dishId missing → 400.
6. Open `dbPool.transaction`. Inside: for each line with a `promotionId`, `SELECT ... FOR UPDATE` (`.for("update")`) on the `dish_promotions` row; validate active/window/usesCount; compute discount via `computeLineTotal`. Build `orderDishes` rows with `priceSnapshot`, `promotionId`, `discountAmount`, `lineTotal`, `dishName`. Sum `lineTotal` → subtotal.
7. Compute `deliveryFeeSnapshot` (only when `fulfillmentMode='delivery'`, `cook.delivery='self'`, coords present) — same as existing code.
8. `totalPrice = subtotal + deliveryFee`. Pre-generate `orderId`. Create the Stripe full PI **before** inserts inside the same try; on Stripe failure return 500. On any DB error after PI creation, `cancelPaymentIntent` then rethrow (keep existing catch pattern).
9. Insert `orders` (status pending, `cancellationAllowed` snapshot, `totalPrice`, `deliveryFeeSnapshot`, `fulfillmentMode`, `pickupAt`, `notes`; leave `listingId`/`quantity`/`unitPrice` null). Insert `orderDishes`. Insert `orderPayments` (type full, authorized). Increment each used promo `usesCount` with `sql\`uses_count + 1\``.
10. Fire-and-forget cook email — pass dish names joined (`rows.map(r=>r.dishName).join(", ")`) instead of `listingTitle`.
11. Return `{ orderId }` (and `clientSecret` if the PI returns one).

Remove all deposit logic and the deposit/balance PI branch — launch is full-payment only.

- [ ] **Step 6: Reshape the GET list**

Remove the `listings` and `listingSubscriptionTiers` joins. Drop `listingTitle`, `listingId`, `quantity`, `unitPrice`, `subscriptionId`, `subscriptionInterval`, `isSubscription` from the response. Extend the `order_dishes` select to include `priceSnapshot`, `discountAmount`, `lineTotal` and return them in the `dishes` array. Keep cook name via `authUser.firstName/lastName`, pickup formatting, totals.

- [ ] **Step 7: Type-check, lint, test, commit**

```bash
git add my-app/app/api/orders/route.ts my-app/lib/order-pricing.ts my-app/__tests__/api/orders/pricing.test.ts
git commit -m "feat(api): multi-dish order creation with per-dish promotions"
```

---

### Task 14: Order detail + cancellation + reviews

**Files:**
- Modify: `my-app/app/api/orders/[orderId]/route.ts`
- Modify: `my-app/app/api/orders/[orderId]/reviews/route.ts`

- [ ] **Step 1: Detail GET reshape**

Mirror Task 13 Step 6 for the single-order GET: drop listing/subscription fields, add `order_dishes` with snapshots, and include `cancellationAllowed` + `pickupAt` so the client can gate the cancel button.

- [ ] **Step 2: Cancellation PATCH**

Implement client cancellation per spec §4.3: read order `cancellationAllowed`, `pickupAt`, status; read cook `leadTime` live; refund only when `cancellationAllowed && pickupAt != null && now < pickupAt - leadTimeHours`. On refund, service_role issues a full Stripe refund and updates `orderPayments`; always set `cancelledAt`/`cancelledBy`/`status='cancelled'`. Return `{ refunded: boolean }`. Reuse `LEAD_TIME_HOURS` (extract it to `my-app/lib/order-pricing.ts` so both routes share it).

- [ ] **Step 3: Reviews POST**

Remove `listingId` from the request schema and insert. Keep validation: order belongs to client, `status='fulfilled'`, `cookId` matches. (RLS already updated in Task 4.)

- [ ] **Step 4: Type-check + commit**

```bash
git add my-app/app/api/orders/[orderId]
git commit -m "feat(api): order detail snapshots, cancellation refund, listing-free reviews"
```

---

### Task 15: Remove dead endpoints

**Files:**
- Delete: `my-app/app/api/listings/**`
- Delete: `my-app/app/api/business/listings/**` (entire tree — dish routes already relocated)
- Delete: `my-app/app/api/favourites/listings/**`
- Delete: `my-app/app/api/subscriptions/**`
- Delete: `my-app/app/api/cooks/[cookId]/listings/**`

- [ ] **Step 1: Delete the trees**

```bash
git rm -r my-app/app/api/listings my-app/app/api/business/listings my-app/app/api/favourites/listings my-app/app/api/subscriptions my-app/app/api/cooks/[cookId]/listings
```

- [ ] **Step 2: Grep for stragglers**

Run a search for any remaining import of the old cook-auth path or deleted routes:
Grep: `business/listings/_lib/cook-auth` and `api/listings` and `api/subscriptions` across `my-app/app` and `my-app/lib`. Fix any remaining importers (there should be none after relocations).

- [ ] **Step 3: Type-check + commit**

Run: `pnpm exec tsc --noEmit` — Expected: PASS.

```bash
git add -A
git commit -m "chore(api): remove listing, favourite-listing, subscription endpoints"
```

---

# PHASE 4 — Frontend (Business dashboard)

> Apply `frontend-design` lightly here: this is internal tooling, so prioritize consistency with the existing dashboard CSS Modules and tokens over novelty. The one place to invest visual care is the Promotions tab — make the active-promo state legible at a glance (status pill + live "ends in / used" counter).

### Task 16: Relocate dashboard listings → dishes

**Files:**
- Move: `business/(dashboard)/listings/page.tsx` → `dishes/page.tsx`
- Move: `listings/dishes/[id]/page.tsx` → `dishes/[id]/page.tsx`
- Move: `listings/dishes/[id]/_dish-detail-context.tsx` → `dishes/[id]/_dish-detail-context.tsx`
- Move: `listings/dishes/new/page.tsx` → `dishes/new/page.tsx`
- Move: `listings/_back-link.tsx` → `dishes/_back-link.tsx`
- Delete: `listings/[id]/page.tsx`, `listings/[id]/_listing-detail-context.tsx`, `listings/[id]/_cover-crop-modal.tsx`, `listings/new/page.tsx`
- Move CSS modules alongside their pages.

- [ ] **Step 1: Move + delete**

Use `git mv` for the relocated files and their `*.module.css` siblings; `git rm` the deleted listing-detail/new pages. Update every relative import and any `/api/business/listings/dishes...` fetch URL to `/api/business/dishes...`. Update internal links from `/business/dashboard/listings...` to `/business/dashboard/dishes...`.

- [ ] **Step 2: Flat dish list**

In `dishes/page.tsx`, render dishes from `GET /api/business/dishes` as a flat list (photo thumb, `name`, `price`, status chip, active-promo badge). Remove any listing grouping UI. "New meal" button → `dishes/new`. Use existing card/list CSS classes; reuse `--grey-*`/`--ink` tokens.

- [ ] **Step 3: Type-check + commit**

```bash
git add -A
git commit -m "feat(business): relocate listings dashboard to Meals/dishes"
```

---

### Task 17: Dish create/edit price + Promotions tab

**Files:**
- Modify: `business/(dashboard)/dishes/new/page.tsx`
- Modify: `business/(dashboard)/dishes/[id]/page.tsx`
- Create: `business/(dashboard)/dishes/[id]/_promotions-tab.tsx`
- Create: `business/(dashboard)/dishes/[id]/_promotions-tab.module.css`

- [ ] **Step 1: Price field on create + edit**

Add a required numeric `price` input (label "Price per meal", `$` prefix, step 0.01, min 0.01) to the dish form; include it in the POST/PATCH body as a number. Validate client-side (> 0) and surface the server error message on failure.

- [ ] **Step 2: Tab shell**

In `dishes/[id]/page.tsx`, add a two-tab switcher ("Details" | "Promotions"). Details = existing content. Promotions renders `<PromotionsTab dishId={id} />`.

- [ ] **Step 3: Promotions tab component**

`_promotions-tab.tsx` (`"use client"`): fetch `GET /api/business/dishes/[dishId]/promotions`; list with active promo pinned top showing a live badge — `ends in Nd` (from `validUntil`) or `N/M used` (from `usesCount`/`maxUses`). "Add promotion" form: type radio (% off / $ off), value input, and a mutually-exclusive radio "End date" vs "Max redemptions" that clears the other field on switch. Submit → POST; on 422 show the returned message. Per-row Deactivate (toggle) and Delete actions. Use tokens; ensure inputs have visible focus and the form is keyboard-navigable. Mobile: stack the form fields single-column under ~640px.

- [ ] **Step 4: Type-check + commit**

```bash
git add -A
git commit -m "feat(business): dish price field and promotions tab"
```

---

### Task 18: Settings order-rules section + nav rename

**Files:**
- Modify: `business/(dashboard)/settings/page.tsx`
- Modify: `business/(dashboard)/_shell.tsx`

- [ ] **Step 1: Order-rules UI**

Add an "Order rules" section: `minOrderQty` (number, default 1), `maxOrderQty` (number, optional, placeholder "No cap"), and a `cancellationAllowed` toggle labeled "Allow clients to cancel before the lead date for a full refund." Wire to `PATCH /api/business/dashboard/settings`. Remove the late-cancel-fee section from the form. Reuse the page's existing field/toggle components and tokens.

- [ ] **Step 2: Nav rename**

In `_shell.tsx`, rename the "Listings" nav item to "Meals" and point it at `/business/dashboard/dishes`. Remove any "Subscriptions" nav entry if present.

- [ ] **Step 3: Type-check + commit**

```bash
git add -A
git commit -m "feat(business): order-rules settings, Meals nav"
```

---

# PHASE 5 — Frontend (Client app)

> `frontend-design` focus area. The browse page and the menu page are the brand's storefront — invest here. Keep the existing 7eats identity (tokens, type, spacing) but make the cook card and the menu's right-rail order summary feel considered: a clear photographic hero per cook, a calm avatar treatment, and an order summary that reads like a receipt-in-progress. One signature touch: the menu's sticky right-rail summary that animates line additions subtly (respect `prefers-reduced-motion`).

### Task 19: Rewrite the cart context

**Files:**
- Modify: `my-app/app/app/_cart-context.tsx`

- [ ] **Step 1: New types + provider**

Replace the file with the multi-dish single-cook model from spec §5.1 (`CartItem` with `dishId`/`name`/`price`/`quantity`/`promotionId`/`discountAmount`/`lineTotal`; `Cart` with `cookId`/`cookName`/`minOrderQty`/`maxOrderQty`/`items`/`fulfillmentMode`/`pickupAt`/`deliveryAddress`/`deliveryFeeSnapshot`/`notes`). Provide: `addItem` (rejects/clears when `cookId` differs — expose a `pendingCookSwitch` flag the UI confirms), `setQuantity`, `removeItem`, `clearCart`, `setFulfillment`, derived `totalQuantity`, `subtotal`, `meetsMinimum`, `withinMaximum`. Remove all subscription/tier/`orderType` fields and `cartMode`.

- [ ] **Step 2: Update consumers compile-clean**

Grep for `useCart`, `setListingItems`, `cartMode`, `listingCount`, `removeListing` across `my-app/app`. Each consumer is updated in its own task below; for now ensure the provider exports compile. Temporary `@ts-expect-error` is not allowed — if a consumer breaks the build, stub its usage minimally and note it for its task.

- [ ] **Step 3: Type-check + commit**

```bash
git add my-app/app/app/_cart-context.tsx
git commit -m "feat(client): multi-dish single-cook cart context"
```

---

### Task 20: Browse → cook cards

**Files:**
- Modify: `my-app/app/app/browse/page.tsx`
- Modify: `my-app/app/app/browse/page.module.css`

- [ ] **Step 1: Replace data + types**

Drop `ListingCard`, `/api/listings`, and the saved-listings logic. Fetch `GET /api/cooks` (pass `lat`/`lng` from `AddressBar` when available). Define `CookCard` type matching the endpoint (`id`, `displayName`, `photoUrl`, `bio`, `tags`, `leadTime`, `delivery`, `pickupCity`, `rating`, `reviewCount`, `representativeDishPhoto`, `distanceKm`).

- [ ] **Step 2: Card + featured strip**

Card: photographic banner (`representativeDishPhoto`, fallback placeholder), overlaid circular avatar (`photoUrl`, fallback initials from `displayName`), `displayName`, `pickupCity` + `distanceKm` when present, tag chips, star rating + count. Whole card links to `/app/cooks/[id]/menu`. Featured strip at top: avatar circle + name; clicking the avatar links to `/app/cooks/[id]` (profile). Empty/loading states use interface voice ("No cooks nearby yet — check back soon."). Responsive grid via existing breakpoints; reduce to one column on mobile. Tokens only; visible focus on card links.

- [ ] **Step 3: Type-check + commit**

```bash
git add my-app/app/app/browse
git commit -m "feat(client): cook-card browse with featured strip"
```

---

### Task 21: New menu ordering page

**Files:**
- Create: `my-app/app/app/cooks/[id]/menu/page.tsx`
- Create: `my-app/app/app/cooks/[id]/menu/_DishModal.tsx`
- Create: `my-app/app/app/cooks/[id]/menu/page.module.css`

- [ ] **Step 1: Page shell + data**

Server component fetches `GET /api/cooks/[cookId]/menu` (404 → `notFound()`). Two-panel layout adapted from the old listing detail page: left = dish cards, right = sticky order summary. Pass data to a `"use client"` child that uses `useCart`.

- [ ] **Step 2: Dish cards + modal**

Each dish card: photo, `name`, description, `price`, promotion badge ("10% off" / "$3 off" computed from `promotion`), quantity stepper (default 0) wired to `useCart.setQuantity`. Clicking the card body opens `_DishModal` (adapted from the old `listings/[id]/_DishModal.tsx`) showing description, ingredients, nutrition, photo gallery. Adding from a different cook triggers the cart's clear-confirm.

- [ ] **Step 3: Right-rail summary**

Live list of selected dishes (name × qty, line total, per-dish promo discount), subtotal, delivery fee (when delivery), total. Fulfillment selector (pickup always; delivery only when `cook.delivery === 'self'`). Pickup time picker constrained to `pickupWindows` + lead time. Min/max feedback ("Minimum 2 items", "Max 8 items reached"). Link to `/app/cooks/[id]` profile. "Go to checkout" disabled until `meetsMinimum`. Subtle add animation, gated on `prefers-reduced-motion`. Mobile: summary collapses into a sticky bottom bar with a total + "Review order" expand.

- [ ] **Step 4: Type-check + commit**

```bash
git add my-app/app/app/cooks/[id]/menu
git commit -m "feat(client): cook menu ordering page with order summary rail"
```

---

### Task 22: Cook profile, search, cart, checkout, orders

**Files:**
- Modify: `cooks/[id]/page.tsx`, `search/page.tsx`, `cart/page.tsx`, `checkout/page.tsx`, `checkout/_payment-form.tsx`, `orders/page.tsx`, `orders/[id]/page.tsx`

- [ ] **Step 1: Cook profile**

Add a policy block (min/max order, human-readable cancellation policy via lead time). Reviews show `Ordered: <dish names>` from the review `dishes[]`. "Order now" button → `/app/cooks/[id]/menu`.

- [ ] **Step 2: Search**

Query cooks by name/tags/city instead of listings (point at `/api/cooks` with a search param or filter client-side from the cook list). Update result cards to the cook-card shape (reuse the browse card component if extracted).

- [ ] **Step 3: Cart page**

Render `CartItem[]`: name × qty, per-dish promo badge + discount, line total, subtotal. Remove subscription tab/tier UI. Quantity edit + remove via `useCart`. Show min/max status.

- [ ] **Step 4: Checkout**

Remove the subscription tab and all subscription branches. Build the `POST /api/orders` body from the cart (`cookId`, `dishes[]` with `promotionId`, `paymentMethodId`, `pickupAt`, `fulfillmentMode`, `deliveryAddress`, `customerLat/Lng`, `notes`). Itemized dish list with promotions above the payment form. `_payment-form.tsx`: keep Stripe Elements wiring; ensure it submits the new body and handles the `{ orderId }` response.

- [ ] **Step 5: Orders list + detail**

List: render the reshaped response (no `listingTitle`); show dish names, totals, status, pickup. Detail: `order_dishes` line items (name, qty, price, promo discount, line total); show the Cancel button only when `cancellationAllowed && pickupAt && now < pickupAt - leadTime`; on cancel call `PATCH /api/orders/[orderId]` and surface `{ refunded }` ("Order cancelled — refund issued." / "Order cancelled.").

- [ ] **Step 6: Type-check + commit**

```bash
git add my-app/app/app
git commit -m "feat(client): profile, search, cart, checkout, orders for dish flow"
```

---

### Task 23: Remove client listing/subscription pages

**Files:**
- Delete: `my-app/app/app/listings/**`
- Delete: `my-app/app/app/subscriptions/page.tsx`
- Modify: `_shell.tsx` (hide Saved + Subscriptions nav)

- [ ] **Step 1: Delete + hide**

```bash
git rm -r my-app/app/app/listings my-app/app/app/subscriptions
```

In the client `_shell.tsx`, remove the Subscriptions nav link and hide the Saved link (comment with a TODO referencing future `followedCooks`).

- [ ] **Step 2: Type-check + commit**

```bash
git add -A
git commit -m "chore(client): remove listing and subscription pages"
```

---

# PHASE 6 — Routing + Verification

### Task 24: proxy.ts routing

**Files:**
- Modify: `my-app/proxy.ts`

- [ ] **Step 1: Update route classification**

Remove `/app/listings/` from `CLIENT_PUBLIC_PREFIXES`. Add a redirect: any `/app/listings*` → `/app/browse`. Remove `/app/saved` from `CLIENT_PROTECTED_EXACT` (page hidden). `/app/cooks/` stays public (covers `/menu`). Confirm `/app/cart` and `/app/checkout` remain public.

- [ ] **Step 2: Type-check + commit**

```bash
git add my-app/proxy.ts
git commit -m "feat(routing): redirect legacy listing routes to browse"
```

---

### Task 25: Full verification pass

- [ ] **Step 1: Static gates**

```bash
pnpm exec tsc --noEmit   # Expected: PASS
pnpm lint                # Expected: PASS (run pnpm format if needed)
pnpm test:run            # Expected: PASS
```

- [ ] **Step 2: Build**

Run: `pnpm build` — Expected: succeeds with no route/type errors.

- [ ] **Step 3: Playwright flow (per CLAUDE.md)**

Start `pnpm dev`. Load Playwright MCP tools. Drive the critical client path: browse (cook cards render) → open a cook menu → add 2+ dishes (meets minimum) → cart → checkout (no subscription tab) → place order → order detail shows dish line items. Check console for 500s/CSP errors. Screenshot browse, menu, checkout, order detail. Then the cook path: dashboard → Meals → create a dish with price → add a promotion (verify XOR validation rejects both/neither) → settings (set min/max + cancellation). Screenshot each.

- [ ] **Step 4: Report**

Summarize: gates status, screenshots, any deviations. Do **not** commit a final wrap-up (user asked for no end commit); leave the working tree as-is for review.

---

## Self-Review

**Spec coverage:** Every §3 schema change → Tasks 1–5. Every §4 endpoint → Tasks 6–15 (removed: 15; relocated: 7; modified cooks: 11; menu: 12; orders: 13–14; settings: 10; promotions: 8–9). Every §5 frontend item → Tasks 16–23. §6 invariants are enforced where the spec assigns them (RLS in Phase 1, service_role + FOR UPDATE in Task 13, XOR in Task 8). §7 out-of-scope items are not implemented. Routing → Task 24.

**Placeholder scan:** The menu assembler (Task 12) and order handler (Task 13 Step 5) describe steps with the key code shown and the mechanical grouping/looping left as explicit instructions — acceptable because the data shapes and helper signatures are fully specified. `inArrayHelper` in Task 12 is explicitly corrected to `inArray` in the notes.

**Type consistency:** `computeLineTotal` and `LEAD_TIME_HOURS` live in `my-app/lib/order-pricing.ts` and are shared by Tasks 13 and 14. `validatePromotionWindow` lives in `promotions/_validate.ts`, imported by Tasks 8 and 9. Dish name is `name` everywhere; promo fields exposed publicly are `id,type,value,validUntil,maxUses,usesCount` consistently in Tasks 8, 12, 17.

**Security:** Every new/modified route in Phase 2–3 begins with session/role/ownership checks and Zod validation; financial mutation (Task 13) is service_role + transaction + `FOR UPDATE`; client never supplies price. RLS rewritten in Phase 1 backs the API.

---

## Deferred (post-launch) — discovered during execution

Phase 1 made `orders.quantity`/`orders.unitPrice` nullable and added NOT NULL pricing to `order_dishes`. Two legacy consumers were not in the original modify list and now run on temporary type-bridges (committed in the Task 4 commit). They produce **degraded but non-crashing** output for new dish-orders and are deferred to post-launch by decision:

- **D1 — Earnings dashboard (`app/api/business/dashboard/earnings/route.ts`):** revenue is grouped by `listingId`; new dish-orders have `listingId = null` and bucket together under an empty key. Reshape to group by dish (or drop the per-listing breakdown). Bridge: null-coalesces the key.
- **D2 — Cook order-status emails (`app/api/business/dashboard/orders/[orderId]/status/route.ts`):** confirm/ready/cancelled emails to the client print per-listing `quantity` and `listingTitle`; these are now defaulted (`quantity ?? 1`). Reshape to list dish names/quantities. Bridge: defaults the values.

Both bridges are marked with code comments. Remove them when D1/D2 are implemented.
