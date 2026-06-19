import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { authUser, listings, orders } from "@/db/schema";

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const rows = await db
      .select({
        id: orders.id,
        cookId: orders.cookId,
        clientId: orders.clientId,
        listingId: orders.listingId,
        status: orders.status,
        quantity: orders.quantity,
        unitPrice: orders.unitPrice,
        totalPrice: orders.totalPrice,
        pickupAt: orders.pickupAt,
        fulfilledAt: orders.fulfilledAt,
        cancelledAt: orders.cancelledAt,
        notes: orders.notes,
        createdAt: orders.createdAt,
        pickupCodeExpiresAt: orders.pickupCodeExpiresAt,
        pickupCodeVerifiedAt: orders.pickupCodeVerifiedAt,
        pickupCodeAttempts: orders.pickupCodeAttempts,
        lateCancelFeeEnabled: orders.lateCancelFeeEnabled,
        lateCancelFeeType: orders.lateCancelFeeType,
        lateCancelFeeValue: orders.lateCancelFeeValue,
        lateCancelWindowHours: orders.lateCancelWindowHours,
        lateCancelFeeApplied: orders.lateCancelFeeApplied,
        listingTitle: listings.title,
        customerName: authUser.name,
        customerFirstName: authUser.firstName,
        customerLastName: authUser.lastName,
      })
      .from(orders)
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .leftJoin(authUser, eq(orders.clientId, authUser.id))
      .where(
        and(
          eq(orders.cookId, cookId),
          inArray(orders.status, ["pending", "confirmed", "ready"]),
          gte(orders.pickupAt, sql`now()`),
        ),
      )
      .orderBy(asc(orders.pickupAt))
      .limit(100);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[dashboard/orders/upcoming]", err);
    return NextResponse.json(
      { error: "Failed to fetch upcoming orders." },
      { status: 500 },
    );
  }
}
