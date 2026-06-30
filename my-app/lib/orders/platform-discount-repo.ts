import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, count, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db as defaultDb } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import type * as schema from "@/db/schema/index";
import { orders } from "@/db/schema/orders";
import { orderPayments } from "@/db/schema/payments";
import { platformDiscountRedemptionFilter } from "@/lib/orders/abandoned-checkout";
import type { PlatformDiscountRow } from "./platform-discount";

type DefaultDb = typeof defaultDb;

type PlacementTx = PgTransaction<
  NeonQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** HTTP or pool transaction — both can run discount reservation queries. */
export type OrderDbTx = Parameters<
  Parameters<typeof defaultDb.transaction>[0]
>[0];

type DiscountDb = DefaultDb | PlacementTx | OrderDbTx;

/** Unpaid checkouts that reserved a per-user platform promo on the payment row. */
export async function countPendingPlatformDiscountReservations(
  dbClient: DiscountDb,
  userId: string,
  discountId: string,
): Promise<number> {
  const [{ pending }] = await dbClient
    .select({ pending: count() })
    .from(orderPayments)
    .innerJoin(orders, eq(orderPayments.orderId, orders.id))
    .where(
      and(
        eq(orderPayments.pendingPlatformDiscountId, discountId),
        eq(orderPayments.clientId, userId),
        eq(orderPayments.type, "full"),
        eq(orderPayments.status, "pending"),
        ne(orders.status, "cancelled"),
      ),
    );
  return Number(pending);
}

/** Paid orders that consumed a per-user platform promo. */
export async function countRedeemedPlatformDiscounts(
  dbClient: DiscountDb,
  userId: string,
  discountId: string,
): Promise<number> {
  const [{ used }] = await dbClient
    .select({ used: count() })
    .from(orders)
    .where(
      and(
        eq(orders.platformDiscountId, discountId),
        eq(orders.clientId, userId),
        platformDiscountRedemptionFilter(),
      ),
    );
  return Number(used);
}

export type PlatformDiscountBlockReason = "already_used" | "pending_checkout";

/** Best candidate the user can still reserve or redeem (preview; non-binding). */
export async function previewPlatformDiscountForUser(
  dbClient: DefaultDb,
  userId: string,
  candidates: Array<{ discount: PlatformDiscountRow; amount: number }>,
): Promise<
  | { amount: number; name: string | null }
  | { amount: 0; blocked: true; reason: PlatformDiscountBlockReason }
  | { amount: 0 }
> {
  for (const cand of candidates) {
    const redeemed = await countRedeemedPlatformDiscounts(
      dbClient,
      userId,
      cand.discount.id,
    );
    if (redeemed >= cand.discount.perUserLimit) {
      continue;
    }
    const pending = await countPendingPlatformDiscountReservations(
      dbClient,
      userId,
      cand.discount.id,
    );
    if (pending > 0) {
      return { amount: 0, blocked: true, reason: "pending_checkout" };
    }
    if (redeemed + pending < cand.discount.perUserLimit) {
      const [row] = await dbClient
        .select({ name: platformDiscounts.name })
        .from(platformDiscounts)
        .where(eq(platformDiscounts.id, cand.discount.id))
        .limit(1);
      return { amount: cand.amount, name: row?.name ?? null };
    }
  }
  const hadCandidate = candidates.length > 0;
  return hadCandidate
    ? { amount: 0, blocked: true, reason: "already_used" }
    : { amount: 0 };
}

/** Active, in-window discounts, parsed into PlatformDiscountRow. */
export async function fetchActiveDiscounts(
  dbClient: DefaultDb = defaultDb,
): Promise<PlatformDiscountRow[]> {
  const rows = await dbClient
    .select()
    .from(platformDiscounts)
    .where(
      and(
        eq(platformDiscounts.isActive, true),
        or(
          isNull(platformDiscounts.startsAt),
          lte(platformDiscounts.startsAt, sql`now()`),
        ),
        or(
          isNull(platformDiscounts.endsAt),
          gt(platformDiscounts.endsAt, sql`now()`),
        ),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    discountType: r.discountType,
    value: Number.parseFloat(r.value),
    maxDiscountAmount:
      r.maxDiscountAmount == null
        ? null
        : Number.parseFloat(r.maxDiscountAmount),
    minOrderSubtotal:
      r.minOrderSubtotal == null ? null : Number.parseFloat(r.minOrderSubtotal),
    perUserLimit: r.perUserLimit,
    createdAt: r.createdAt,
  }));
}

/**
 * Pick the first best-first candidate the user is still entitled to, under a
 * transaction-scoped advisory lock keyed on (discount, user). MUST be called
 * inside a dbPool.transaction so the lock + count share one session, and the
 * lock is held until the order insert commits.
 */
export async function resolvePlatformDiscount(
  tx: PlacementTx,
  userId: string,
  candidates: Array<{ discount: PlatformDiscountRow; amount: number }>,
): Promise<{ discountId: string; amount: number } | null> {
  for (const cand of candidates) {
    const key = `pd:${cand.discount.id}:${userId}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    const redeemed = await countRedeemedPlatformDiscounts(
      tx,
      userId,
      cand.discount.id,
    );
    const pending = await countPendingPlatformDiscountReservations(
      tx,
      userId,
      cand.discount.id,
    );
    if (redeemed + pending < cand.discount.perUserLimit) {
      return { discountId: cand.discount.id, amount: cand.amount };
    }
  }
  return null;
}

/** Copy a checkout reservation onto the order once payment is authorized. */
export async function commitPendingPlatformDiscount(
  tx: OrderDbTx,
  orderId: string,
): Promise<void> {
  const [payment] = await tx
    .select({
      pendingId: orderPayments.pendingPlatformDiscountId,
      pendingAmount: orderPayments.pendingPlatformDiscountAmount,
    })
    .from(orderPayments)
    .where(
      and(eq(orderPayments.orderId, orderId), eq(orderPayments.type, "full")),
    )
    .limit(1);

  if (!payment?.pendingId || !payment.pendingAmount) return;

  await tx
    .update(orders)
    .set({
      platformDiscountId: payment.pendingId,
      platformDiscountAmount: payment.pendingAmount,
    })
    .where(eq(orders.id, orderId));
}
