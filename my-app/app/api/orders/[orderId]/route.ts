import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  authUser,
  cookProfiles,
  orderDishes,
  orders,
  reviews,
} from "@/db/schema";
import { formatPickupLocation } from "@/lib/address";
import { auth } from "@/lib/auth";
import { resolveOrderLeadTimeRules } from "@/lib/lead-time";
import {
  formatOrderTimingDate,
  formatOrderTimingWindow,
} from "@/lib/order-timing";
import { formatClientOrderTiming } from "@/lib/order-timing-label";
import { orderHasPlacedPaymentFilter } from "@/lib/orders/abandoned-checkout";
import {
  cancelClientOrder,
  getClientCancelPolicy,
} from "@/lib/orders/cancel-order";
import { resolveOrderCookFields } from "@/lib/orders/cook-order-fields";
import { getTaxLabel } from "@/lib/tax";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.string().uuid();

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const [row] = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalPrice: orders.totalPrice,
        taxAmount: orders.taxAmount,
        taxProvince: orders.taxProvince,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        fulfillmentWindowStart: orders.fulfillmentWindowStart,
        fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
        notes: orders.notes,
        deliveryDetails: orders.deliveryDetails,
        createdAt: orders.createdAt,
        pickupCode: orders.pickupCode,
        fulfillmentMode: orders.fulfillmentMode,
        deliveryAddress: orders.deliveryAddress,
        deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
        platformDiscountAmount: orders.platformDiscountAmount,
        cancellationAllowed: orders.cancellationAllowed,
        cancelledAt: orders.cancelledAt,
        leadTimeSnapshot: orders.leadTimeSnapshot,
        leadTimeCutoffSnapshot: orders.leadTimeCutoffSnapshot,
        cookFirstName: authUser.firstName,
        cookLastName: authUser.lastName,
        cookDisplayName: cookProfiles.displayName,
        cookPhotoUrl: cookProfiles.photoUrl,
        cookBannerUrl: cookProfiles.bannerUrl,
        cookNeighborhood: authUser.neighborhood,
        cookPickupStreet: cookProfiles.pickupStreet,
        cookPickupUnit: cookProfiles.pickupUnit,
        cookPickupCity: cookProfiles.pickupCity,
        cookPickupProvince: cookProfiles.pickupProvince,
        cookPickupPostal: cookProfiles.pickupPostal,
        cookLeadTime: cookProfiles.leadTime,
        cookLeadTimeCutoff: cookProfiles.leadTimeCutoff,
      })
      .from(orders)
      .leftJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.clientId, session.user.id),
          orderHasPlacedPaymentFilter(),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const dishRows = await db
      .select({
        id: orderDishes.id,
        dishName: orderDishes.dishName,
        quantity: orderDishes.quantity,
        priceSnapshot: orderDishes.priceSnapshot,
        discountAmount: orderDishes.discountAmount,
        lineTotal: orderDishes.lineTotal,
        sortOrder: orderDishes.sortOrder,
      })
      .from(orderDishes)
      .where(eq(orderDishes.orderId, orderId));

    const [reviewRow] = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
      })
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);

    const pickupAtIso =
      row.pickupAt instanceof Date ? row.pickupAt.toISOString() : row.pickupAt;
    const fulfillmentWindowStartIso =
      row.fulfillmentWindowStart instanceof Date
        ? row.fulfillmentWindowStart.toISOString()
        : row.fulfillmentWindowStart;
    const fulfillmentWindowEndIso =
      row.fulfillmentWindowEnd instanceof Date
        ? row.fulfillmentWindowEnd.toISOString()
        : row.fulfillmentWindowEnd;
    const timing = {
      pickupAt: pickupAtIso,
      fulfillmentWindowStart: fulfillmentWindowStartIso,
      fulfillmentWindowEnd: fulfillmentWindowEndIso,
    };
    const fulfillmentMode =
      row.fulfillmentMode === "delivery" || row.fulfillmentMode === "pickup"
        ? row.fulfillmentMode
        : null;
    const clientTiming = formatClientOrderTiming({
      pickupAt: pickupAtIso,
      fulfillmentWindowStart: row.fulfillmentWindowStart,
      fulfillmentWindowEnd: row.fulfillmentWindowEnd,
      fulfillmentMode,
    });

    const cookFields = resolveOrderCookFields(row);

    let pickupAddress: string | null = null;
    if (row.fulfillmentMode === "delivery") {
      const addr = row.deliveryAddress as Record<string, string> | null;
      if (addr) {
        pickupAddress = [
          addr.street,
          addr.unit,
          addr.city,
          addr.province,
          addr.postal,
        ]
          .filter(Boolean)
          .join(", ");
      }
    } else {
      // Compose the cook's real pickup address from the structured fields the
      // onboarding/settings flow actually writes; fall back to neighborhood
      // (city-level) only when no street address is on file.
      pickupAddress =
        formatPickupLocation({
          street: row.cookPickupStreet,
          unit: row.cookPickupUnit,
          city: row.cookPickupCity,
          province: row.cookPickupProvince,
          postal: row.cookPickupPostal,
        }) ??
        row.cookNeighborhood ??
        null;
    }

    const leadTimeRules = resolveOrderLeadTimeRules(row);

    const cancelPolicy = getClientCancelPolicy({
      status: row.status,
      cancellationAllowed: row.cancellationAllowed,
      pickupAt: row.pickupAt instanceof Date ? row.pickupAt : null,
      fulfillmentWindowStart: row.fulfillmentWindowStart,
      cookLeadTime: leadTimeRules.leadTime,
      cookLeadTimeCutoff: leadTimeRules.leadTimeCutoff,
      fulfillmentMode:
        row.fulfillmentMode === "delivery" || row.fulfillmentMode === "pickup"
          ? row.fulfillmentMode
          : null,
    });

    const data = {
      id: row.id,
      status: row.status,
      totalPrice: row.totalPrice,
      taxAmount: row.taxAmount,
      taxProvince: row.taxProvince,
      taxLabel: row.taxProvince ? getTaxLabel(row.taxProvince) : null,
      currency: row.currency,
      pickupAt: pickupAtIso,
      fulfillmentWindowStart: fulfillmentWindowStartIso,
      fulfillmentWindowEnd: fulfillmentWindowEndIso,
      notes: row.notes ?? null,
      deliveryDetails: row.deliveryDetails ?? null,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
      pickupCode: row.status === "ready" ? (row.pickupCode ?? null) : null,
      ...cookFields,
      fulfillmentMode: row.fulfillmentMode,
      deliveryFeeSnapshot: row.deliveryFeeSnapshot,
      platformDiscountAmount: row.platformDiscountAmount,
      cancellationAllowed: row.cancellationAllowed,
      cancellable: cancelPolicy.cancellable,
      refundEligible: cancelPolicy.refundEligible,
      refundDeadline: cancelPolicy.refundDeadline,
      refundDeadlineLabel: cancelPolicy.refundDeadlineLabel,
      cancelSummary: cancelPolicy.summary,
      cancelDetail: cancelPolicy.detail,
      cancelModalReminder: cancelPolicy.modalReminder,
      timingSchedule: clientTiming.schedule,
      timingHint: clientTiming.hint,
      pickupDate: formatOrderTimingDate(timing),
      pickupWindow: formatOrderTimingWindow(timing),
      pickupAddress,
      cancelledAt:
        row.cancelledAt instanceof Date
          ? row.cancelledAt.toISOString()
          : (row.cancelledAt ?? null),
      deliveryAddress:
        row.fulfillmentMode === "delivery"
          ? (row.deliveryAddress as object | null)
          : null,
      dishes: dishRows.sort((a, b) => a.sortOrder - b.sortOrder),
      review: reviewRow
        ? {
            id: reviewRow.id,
            rating: reviewRow.rating,
            comment: reviewRow.comment ?? "",
          }
        : null,
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[orders/orderId/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch order." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const result = await cancelClientOrder(
      orderId,
      session.user.id,
      session.user.id,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, refunded: result.refunded });
  } catch (err) {
    console.error("[orders/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to cancel order." },
      { status: 500 },
    );
  }
}
