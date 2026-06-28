import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { authUser, listings, orders } from "@/db/schema";
import { orderHasPlacedPaymentFilter } from "@/lib/orders/abandoned-checkout";

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  // The order's scheduled moment: the pinned pickup minute when set, else the
  // fulfillment window (start/end). A freshly placed order always has a null
  // `pickupAt` (set only when a cook pins a delivery time, never for pickup), so
  // comparing `pickupAt` alone excludes every new request — NULL >= now() is
  // NULL, not true. COALESCE onto the window, captured for both modes at order
  // time, mirrors the orders list endpoint.
  const scheduledStart = sql`COALESCE(${orders.pickupAt}, ${orders.fulfillmentWindowStart})`;
  const scheduledEnd = sql`COALESCE(${orders.pickupAt}, ${orders.fulfillmentWindowEnd}, ${orders.fulfillmentWindowStart})`;

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
        fulfillmentMode: orders.fulfillmentMode,
        fulfillmentWindowStart: orders.fulfillmentWindowStart,
        fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
        fulfilledAt: orders.fulfilledAt,
        cancelledAt: orders.cancelledAt,
        notes: orders.notes,
        deliveryDetails: orders.deliveryDetails,
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
        clientAccountStatus: authUser.status,
        isGuestCheckout: orders.isGuestCheckout,
        clientIsGuestAccount: authUser.isGuestAccount,
      })
      .from(orders)
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .leftJoin(authUser, eq(orders.clientId, authUser.id))
      .where(
        and(
          eq(orders.cookId, cookId),
          orderHasPlacedPaymentFilter(),
          inArray(orders.status, ["pending", "confirmed", "ready"]),
          // Still "upcoming" until the scheduled window has fully passed.
          gte(scheduledEnd, sql`now()`),
        ),
      )
      .orderBy(asc(scheduledStart))
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
