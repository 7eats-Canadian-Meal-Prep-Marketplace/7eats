import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { orderCandidatesByValue } from "@/lib/orders/platform-discount";
import {
  fetchActiveDiscounts,
  previewPlatformDiscountForUser,
} from "@/lib/orders/platform-discount-repo";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ amount: 0 });
  }

  const [userRow] = await db
    .select({ isGuestAccount: authUser.isGuestAccount })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);
  if (userRow?.isGuestAccount) {
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
  const preview = await previewPlatformDiscountForUser(
    db,
    session.user.id,
    candidates,
  );

  return NextResponse.json(preview);
}
