import { and, count, desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, cookProfiles, orderDishes, orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ensureStripeCustomer } from "@/lib/guest/client";
import { orderHasPlacedPaymentFilter } from "@/lib/orders/abandoned-checkout";
import { resolveOrderCookFields } from "@/lib/orders/cook-order-fields";
import {
  createOrderBodySchema,
  placeClientOrder,
} from "@/lib/orders/place-order";
import {
  formatOrderTimingDate,
  formatOrderTimingWindow,
} from "@/lib/orders/timing";
import { formatClientOrderTiming } from "@/lib/orders/timing-label";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const VALID_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "ready",
  "fulfilled",
  "cancelled",
] as const;
type OrderStatusValue = (typeof VALID_ORDER_STATUSES)[number];

// ─── GET: client order list ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const rawStatus = params.get("status");
  const statusFilter: OrderStatusValue | undefined =
    rawStatus && VALID_ORDER_STATUSES.includes(rawStatus as OrderStatusValue)
      ? (rawStatus as OrderStatusValue)
      : undefined;

  const rawLimit = Number.parseInt(params.get("limit") ?? "20", 10);
  const limit = Number.isNaN(rawLimit)
    ? 20
    : Math.min(100, Math.max(1, rawLimit));
  const rawOffset = Number.parseInt(params.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

  try {
    const clientScope = and(
      eq(orders.clientId, session.user.id),
      orderHasPlacedPaymentFilter(),
    );
    const whereClause = statusFilter
      ? and(clientScope, eq(orders.status, statusFilter))
      : clientScope;

    const [{ total }] = await db
      .select({ total: count() })
      .from(orders)
      .where(whereClause);

    const rows = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalPrice: orders.totalPrice,
        taxAmount: orders.taxAmount,
        taxProvince: orders.taxProvince,
        deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        fulfillmentWindowStart: orders.fulfillmentWindowStart,
        fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
        notes: orders.notes,
        deliveryDetails: orders.deliveryDetails,
        createdAt: orders.createdAt,
        pickupCode: orders.pickupCode,
        cookFirstName: authUser.firstName,
        cookLastName: authUser.lastName,
        cookDisplayName: cookProfiles.displayName,
        cookPhotoUrl: cookProfiles.photoUrl,
        cookBannerUrl: cookProfiles.bannerUrl,
        fulfillmentMode: orders.fulfillmentMode,
      })
      .from(orders)
      .leftJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
      .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const orderIds = rows.map((r) => r.id);
    const dishRows = orderIds.length
      ? await db
          .select({
            orderId: orderDishes.orderId,
            id: orderDishes.id,
            dishName: orderDishes.dishName,
            quantity: orderDishes.quantity,
            priceSnapshot: orderDishes.priceSnapshot,
            discountAmount: orderDishes.discountAmount,
            lineTotal: orderDishes.lineTotal,
            sortOrder: orderDishes.sortOrder,
          })
          .from(orderDishes)
          .where(inArray(orderDishes.orderId, orderIds))
      : [];

    const dishesByOrderId: Record<string, (typeof dishRows)[number][]> = {};
    for (const d of dishRows) {
      if (!dishesByOrderId[d.orderId]) dishesByOrderId[d.orderId] = [];
      dishesByOrderId[d.orderId].push(d);
    }

    const data = rows.map((r) => {
      const pickupAtIso =
        r.pickupAt instanceof Date ? r.pickupAt.toISOString() : r.pickupAt;
      const fulfillmentWindowStartIso =
        r.fulfillmentWindowStart instanceof Date
          ? r.fulfillmentWindowStart.toISOString()
          : r.fulfillmentWindowStart;
      const fulfillmentWindowEndIso =
        r.fulfillmentWindowEnd instanceof Date
          ? r.fulfillmentWindowEnd.toISOString()
          : r.fulfillmentWindowEnd;
      const timing = {
        pickupAt: pickupAtIso,
        fulfillmentWindowStart: fulfillmentWindowStartIso,
        fulfillmentWindowEnd: fulfillmentWindowEndIso,
      };
      const fulfillmentMode =
        r.fulfillmentMode === "delivery" || r.fulfillmentMode === "pickup"
          ? r.fulfillmentMode
          : null;
      const clientTiming = formatClientOrderTiming({
        pickupAt: pickupAtIso,
        fulfillmentWindowStart: r.fulfillmentWindowStart,
        fulfillmentWindowEnd: r.fulfillmentWindowEnd,
        fulfillmentMode,
      });
      return {
        id: r.id,
        status: r.status,
        totalPrice: r.totalPrice,
        taxAmount: r.taxAmount,
        taxProvince: r.taxProvince,
        deliveryFeeSnapshot: r.deliveryFeeSnapshot,
        currency: r.currency,
        pickupAt: pickupAtIso,
        fulfillmentWindowStart: fulfillmentWindowStartIso,
        fulfillmentWindowEnd: fulfillmentWindowEndIso,
        notes: r.notes ?? null,
        deliveryDetails: r.deliveryDetails ?? null,
        createdAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        pickupCode: r.status === "ready" ? (r.pickupCode ?? null) : null,
        dishes: (dishesByOrderId[r.id] ?? []).map((d) => ({
          id: d.id,
          dishName: d.dishName,
          quantity: d.quantity,
          priceSnapshot: d.priceSnapshot,
          discountAmount: d.discountAmount,
          lineTotal: d.lineTotal,
          sortOrder: d.sortOrder,
        })),
        ...resolveOrderCookFields(r),
        fulfillmentMode: r.fulfillmentMode,
        pickupDate: formatOrderTimingDate(timing),
        pickupWindow: formatOrderTimingWindow(timing),
        timingSchedule: clientTiming.schedule,
        timingHint: clientTiming.hint,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset },
    });
  } catch (err) {
    console.error("[orders/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 },
    );
  }
}

// ─── POST: multi-dish order creation (logged-in clients) ────────────────────

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const withinLimit = await logAndCheckRateLimit(`order:${session.user.id}`, {
    windowMinutes: 5,
    maxAttempts: 10,
  });
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many orders in a short time. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = createOrderBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const [userRow] = await db
      .select({
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        onboardingCompletedAt: authUser.onboardingCompletedAt,
        isGuestAccount: authUser.isGuestAccount,
      })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!userRow?.onboardingCompletedAt) {
      return NextResponse.json(
        { error: "Complete onboarding before placing an order." },
        { status: 403 },
      );
    }

    if (userRow.isGuestAccount) {
      return NextResponse.json(
        {
          error:
            "Guest checkout orders must be placed without signing in. Create an account to order again.",
        },
        { status: 403 },
      );
    }

    const displayName =
      [userRow.firstName, userRow.lastName].filter(Boolean).join(" ") ||
      session.user.name ||
      userRow.email;

    const stripeCustomerId = await ensureStripeCustomer(
      session.user.id,
      userRow.email,
      displayName,
    );

    const result = await placeClientOrder(
      {
        id: session.user.id,
        email: userRow.email,
        firstName: userRow.firstName,
        lastName: userRow.lastName,
        displayName,
        stripeCustomerId,
      },
      parsed.data,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          unavailableDishes: result.unavailableDishes,
          dishId: result.dishId,
        },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { orderId: result.orderId, clientSecret: result.clientSecret },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[orders/POST]", err);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 },
    );
  }
}
