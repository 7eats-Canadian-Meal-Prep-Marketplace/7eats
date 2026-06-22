import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, cookProfiles, orderDishes, orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRefundEligible } from "@/lib/order-pricing";
import {
  formatOrderTimingDate,
  formatOrderTimingWindow,
} from "@/lib/order-timing";
import { cancelClientOrder } from "@/lib/orders/cancel-order";
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
        createdAt: orders.createdAt,
        pickupCode: orders.pickupCode,
        fulfillmentMode: orders.fulfillmentMode,
        deliveryAddress: orders.deliveryAddress,
        deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
        cancellationAllowed: orders.cancellationAllowed,
        cancelledAt: orders.cancelledAt,
        cookFirstName: authUser.firstName,
        cookLastName: authUser.lastName,
        cookNeighborhood: authUser.neighborhood,
        cookPickupAddress: cookProfiles.pickupAddress,
        cookLeadTime: cookProfiles.leadTime,
      })
      .from(orders)
      .leftJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(and(eq(orders.id, orderId), eq(orders.clientId, session.user.id)))
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

    const cookName =
      [row.cookFirstName, row.cookLastName].filter(Boolean).join(" ") || null;
    const cookInitials =
      [row.cookFirstName?.[0], row.cookLastName?.[0]]
        .filter(Boolean)
        .join("") || null;

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
      pickupAddress = row.cookPickupAddress ?? row.cookNeighborhood ?? null;
    }

    const refundEligible = isRefundEligible(
      row.pickupAt instanceof Date ? row.pickupAt : null,
      row.cookLeadTime,
      row.cancellationAllowed,
    );
    const cancellable =
      ["pending", "confirmed"].includes(row.status) && row.pickupAt != null;

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
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
      pickupCode: row.status === "ready" ? (row.pickupCode ?? null) : null,
      cookName,
      cookInitials,
      fulfillmentMode: row.fulfillmentMode,
      deliveryFeeSnapshot: row.deliveryFeeSnapshot,
      cancellationAllowed: row.cancellationAllowed,
      cancellable,
      refundEligible,
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
