import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, cookProfiles, orderDishes, orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import { formatClientOrderTiming } from "@/lib/order-timing-label";
import {
  cancelClientOrder,
  getClientCancelPolicy,
} from "@/lib/orders/cancel-order";
import { resolveOrderCookFields } from "@/lib/orders/cook-order-fields";
import { getTaxLabel } from "@/lib/tax";

function formatPickupDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatPickupWindow(isoString: string, windowHours = 2): string {
  const d = new Date(isoString);
  const start = d
    .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
    .toLowerCase()
    .replace(":00", "");
  const end = new Date(d.getTime() + windowHours * 3600000)
    .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
    .toLowerCase()
    .replace(":00", "");
  return `${start} – ${end}`;
}

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
        cookDisplayName: cookProfiles.displayName,
        cookPhotoUrl: cookProfiles.photoUrl,
        cookBannerUrl: cookProfiles.bannerUrl,
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
    const fulfillmentMode =
      row.fulfillmentMode === "delivery" || row.fulfillmentMode === "pickup"
        ? row.fulfillmentMode
        : null;
    const timing = formatClientOrderTiming({
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
      pickupAddress = row.cookPickupAddress ?? row.cookNeighborhood ?? null;
    }

    const cancelPolicy = getClientCancelPolicy({
      status: row.status,
      cancellationAllowed: row.cancellationAllowed,
      pickupAt: row.pickupAt instanceof Date ? row.pickupAt : null,
      fulfillmentWindowStart: row.fulfillmentWindowStart,
      cookLeadTime: row.cookLeadTime,
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
      notes: row.notes ?? null,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
      pickupCode: row.status === "ready" ? (row.pickupCode ?? null) : null,
      ...cookFields,
      fulfillmentMode: row.fulfillmentMode,
      deliveryFeeSnapshot: row.deliveryFeeSnapshot,
      cancellationAllowed: row.cancellationAllowed,
      cancellable: cancelPolicy.cancellable,
      refundEligible: cancelPolicy.refundEligible,
      refundDeadline: cancelPolicy.refundDeadline,
      refundDeadlineLabel: cancelPolicy.refundDeadlineLabel,
      cancelSummary: cancelPolicy.summary,
      cancelDetail: cancelPolicy.detail,
      cancelModalReminder: cancelPolicy.modalReminder,
      timingSchedule: timing.schedule,
      timingHint: timing.hint,
      pickupDate: pickupAtIso ? formatPickupDate(pickupAtIso) : null,
      pickupWindow: pickupAtIso ? formatPickupWindow(pickupAtIso) : null,
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
