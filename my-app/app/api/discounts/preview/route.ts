import { and, count, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import { orders } from "@/db/schema/orders";
import { auth } from "@/lib/auth";
import { orderCandidatesByValue } from "@/lib/orders/platform-discount";
import { fetchActiveDiscounts } from "@/lib/orders/platform-discount-repo";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ amount: 0 });
  }
  const subtotal = Number.parseFloat(
    req.nextUrl.searchParams.get("subtotal") ?? "0",
  );
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return NextResponse.json({ amount: 0 });
  }

  const active = await fetchActiveDiscounts();
  const candidates = orderCandidatesByValue(active, subtotal);

  // Best candidate the user has NOT exhausted (preview only; non-binding).
  for (const cand of candidates) {
    const [{ used }] = await db
      .select({ used: count() })
      .from(orders)
      .where(
        and(
          eq(orders.platformDiscountId, cand.discount.id),
          eq(orders.clientId, session.user.id),
          ne(orders.status, "cancelled"),
        ),
      );
    if (Number(used) < cand.discount.perUserLimit) {
      const [row] = await db
        .select({ name: platformDiscounts.name })
        .from(platformDiscounts)
        .where(eq(platformDiscounts.id, cand.discount.id))
        .limit(1);
      return NextResponse.json({
        amount: cand.amount,
        name: row?.name ?? null,
      });
    }
  }
  return NextResponse.json({ amount: 0 });
}
