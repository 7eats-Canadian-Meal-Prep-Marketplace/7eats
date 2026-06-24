import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, count, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db as defaultDb } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import type * as schema from "@/db/schema/index";
import { orders } from "@/db/schema/orders";

export type PlatformDiscountRow = {
  id: string;
  discountType: "percentage" | "fixed";
  value: number;
  maxDiscountAmount: number | null;
  minOrderSubtotal: number | null;
  perUserLimit: number;
  createdAt: Date;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dollar value of a discount for a given subtotal. 0 if it does not qualify. */
export function computeDiscountValue(
  d: PlatformDiscountRow,
  subtotal: number,
): number {
  if (d.minOrderSubtotal != null && subtotal < d.minOrderSubtotal) return 0;
  if (subtotal <= 0) return 0;
  if (d.discountType === "fixed") return round2(Math.min(d.value, subtotal));
  const raw = (subtotal * d.value) / 100;
  const capped =
    d.maxDiscountAmount != null ? Math.min(raw, d.maxDiscountAmount) : raw;
  return round2(Math.min(capped, subtotal));
}

/** Candidates with a positive dollar value, best-first; tie-break newest. */
export function orderCandidatesByValue(
  discounts: PlatformDiscountRow[],
  subtotal: number,
): Array<{ discount: PlatformDiscountRow; amount: number }> {
  return discounts
    .map((d) => ({ discount: d, amount: computeDiscountValue(d, subtotal) }))
    .filter((c) => c.amount > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        b.discount.createdAt.getTime() - a.discount.createdAt.getTime(),
    );
}

type DefaultDb = typeof defaultDb;

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
type PlacementTx = PgTransaction<
  NeonQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export async function resolvePlatformDiscount(
  tx: PlacementTx,
  userId: string,
  candidates: Array<{ discount: PlatformDiscountRow; amount: number }>,
): Promise<{ discountId: string; amount: number } | null> {
  for (const cand of candidates) {
    const key = `pd:${cand.discount.id}:${userId}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    const [{ used }] = await tx
      .select({ used: count() })
      .from(orders)
      .where(
        and(
          eq(orders.platformDiscountId, cand.discount.id),
          eq(orders.clientId, userId),
          ne(orders.status, "cancelled"),
        ),
      );
    if (Number(used) < cand.discount.perUserLimit) {
      return { discountId: cand.discount.id, amount: cand.amount };
    }
  }
  return null;
}
