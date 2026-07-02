import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import { fetchActiveDiscounts } from "@/lib/orders/platform-discount-repo";
import { buildPlatformDiscountTeaser } from "@/lib/orders/platform-discount-teaser";

/** Public teaser for signed-out shoppers — terms only, never applied. */
export async function GET(req: NextRequest) {
  const subtotalRaw = req.nextUrl.searchParams.get("subtotal");
  const subtotal =
    subtotalRaw == null ? undefined : Number.parseFloat(subtotalRaw);
  const parsedSubtotal =
    subtotal != null && Number.isFinite(subtotal) && subtotal > 0
      ? subtotal
      : undefined;

  const active = await fetchActiveDiscounts();
  if (active.length === 0) {
    return NextResponse.json({ available: false });
  }

  const teaser = buildPlatformDiscountTeaser(
    active,
    "Platform offer",
    parsedSubtotal,
  );
  if (!teaser) {
    return NextResponse.json({ available: false });
  }

  const [row] = await db
    .select({ name: platformDiscounts.name })
    .from(platformDiscounts)
    .where(eq(platformDiscounts.id, teaser.discountId))
    .limit(1);

  return NextResponse.json({
    available: true,
    name: row?.name ?? teaser.name,
    headline: teaser.headline,
    qualifier: teaser.qualifier,
    projectedAmount: teaser.projectedAmount,
  });
}
