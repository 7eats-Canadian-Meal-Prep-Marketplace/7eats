import { sql } from "drizzle-orm";
import type { OrderDbTx } from "@/lib/orders/platform-discount-repo";

/**
 * Serializes concurrent status-changing operations on the same order (cook
 * status PATCH, client cancellation, guest cancellation) so only one can
 * validate against the current status and act at a time. Call as the first
 * statement inside a dbPool transaction, before re-reading the order's
 * status — every caller must use this helper (not a hand-rolled lock key) so
 * they all contend for the same lock.
 */
export async function acquireOrderStatusLock(
  tx: OrderDbTx,
  orderId: string,
): Promise<void> {
  const key = `order-status:${orderId}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
}
