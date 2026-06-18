import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, dbPool } from "@/db";
import {
  authUser,
  authUserTable,
  cookProfiles,
  dishes,
  dishPromotions,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { calcDeliveryFee } from "@/lib/delivery-fee";
import {
  sendOrderPlacedEmailToCook,
  sendOrderReceiptToClient,
} from "@/lib/emails/order-events";
import { getDrivingDistanceKm } from "@/lib/mapbox-directions";
import { computeLineTotal, earliestPickup } from "@/lib/order-pricing";
import { logAndCheckRateLimit } from "@/lib/rate-limit";
import {
  cancelPaymentIntent,
  createFullPaymentIntent,
} from "@/lib/stripe-payments";
import { getOrCreateStripeCustomer } from "@/lib/stripe-subscriptions";

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
    const whereClause = statusFilter
      ? and(
          eq(orders.clientId, session.user.id),
          eq(orders.status, statusFilter),
        )
      : eq(orders.clientId, session.user.id);

    const [{ total }] = await db
      .select({ total: count() })
      .from(orders)
      .where(whereClause);

    const rows = await db
      .select({
        id: orders.id,
        status: orders.status,
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        notes: orders.notes,
        createdAt: orders.createdAt,
        pickupCode: orders.pickupCode,
        cookFirstName: authUser.firstName,
        cookLastName: authUser.lastName,
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
      return {
        id: r.id,
        status: r.status,
        totalPrice: r.totalPrice,
        currency: r.currency,
        pickupAt: pickupAtIso,
        notes: r.notes ?? null,
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
        cookName:
          [r.cookFirstName, r.cookLastName].filter(Boolean).join(" ") || null,
        cookInitials:
          [r.cookFirstName?.[0], r.cookLastName?.[0]]
            .filter(Boolean)
            .join("") || null,
        fulfillmentMode: r.fulfillmentMode,
        pickupDate: pickupAtIso ? formatPickupDate(pickupAtIso) : null,
        pickupWindow: pickupAtIso ? formatPickupWindow(pickupAtIso) : null,
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

// ─── POST: multi-dish order creation ──────────────────────────────────────────

const createOrderSchema = z.object({
  cookId: z.string().uuid(),
  dishes: z
    .array(
      z.object({
        dishId: z.string().uuid(),
        quantity: z.number().int().min(1),
        promotionId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1),
  paymentMethodId: z.string().min(1),
  pickupAt: z.string().datetime(),
  fulfillmentMode: z.enum(["pickup", "delivery"]).optional(),
  deliveryAddress: z
    .object({
      street: z.string().min(1).max(200),
      unit: z.string().max(50).optional(),
      city: z.string().min(1).max(100),
      province: z.string().length(2),
      postal: z.string().min(5).max(10),
    })
    .optional(),
  customerLat: z.number().min(-90).max(90).optional(),
  customerLng: z.number().min(-180).max(180).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  // Per-client throttle on order creation (abuse / double-submit protection).
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

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const {
    cookId,
    dishes: lines,
    paymentMethodId,
    pickupAt,
    fulfillmentMode,
    deliveryAddress,
    customerLat,
    customerLng,
    notes,
  } = parsed.data;

  try {
    // 1. Load and verify the cook (active account).
    const [cook] = await db
      .select({
        id: cookProfiles.id,
        displayName: cookProfiles.displayName,
        userStatus: authUser.status,
        minOrderQty: cookProfiles.minOrderQty,
        maxOrderQty: cookProfiles.maxOrderQty,
        leadTime: cookProfiles.leadTime,
        cancellationAllowed: cookProfiles.cancellationAllowed,
        platformFeePct: cookProfiles.platformFeePct,
        stripeAccountId: cookProfiles.stripeAccountId,
        delivery: cookProfiles.delivery,
        pickupLat: cookProfiles.pickupLat,
        pickupLng: cookProfiles.pickupLng,
        maxDeliveryKm: cookProfiles.maxDeliveryKm,
        deliveryRatePerKm: cookProfiles.deliveryRatePerKm,
        deliveryFlatFee: cookProfiles.deliveryFlatFee,
        freeDeliveryAbove: cookProfiles.freeDeliveryAbove,
      })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook || cook.userStatus !== "active") {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }
    if (!cook.stripeAccountId) {
      return NextResponse.json(
        { error: "Cook payment account not connected." },
        { status: 400 },
      );
    }

    // 2. Pickup must respect the cook's lead time.
    if (new Date(pickupAt) < earliestPickup(cook.leadTime)) {
      return NextResponse.json(
        { error: "Pickup time is too soon for this cook's lead time." },
        { status: 422 },
      );
    }

    // 3. Min/max order quantity (total across all dishes).
    const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
    if (totalQty < cook.minOrderQty) {
      return NextResponse.json(
        { error: `Minimum order is ${cook.minOrderQty} item(s).` },
        { status: 422 },
      );
    }
    if (cook.maxOrderQty != null && totalQty > cook.maxOrderQty) {
      return NextResponse.json(
        { error: `Maximum order is ${cook.maxOrderQty} item(s).` },
        { status: 422 },
      );
    }

    // 4. Load all requested dishes (active, belonging to this cook).
    const dishIds = lines.map((l) => l.dishId);
    const dishRows = await db
      .select({ id: dishes.id, name: dishes.name, price: dishes.price })
      .from(dishes)
      .where(
        and(
          inArray(dishes.id, dishIds),
          eq(dishes.cookId, cookId),
          eq(dishes.status, "active"),
        ),
      );
    const dishById = new Map(dishRows.map((d) => [d.id, d]));
    for (const l of lines) {
      if (!dishById.has(l.dishId)) {
        return NextResponse.json(
          { error: "One or more dishes are unavailable." },
          { status: 422 },
        );
      }
    }

    // 5. Onboarding + Stripe customer.
    const [userRow] = await db
      .select({
        stripeCustomerId: authUser.stripeCustomerId,
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        onboardingCompletedAt: authUser.onboardingCompletedAt,
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

    let stripeCustomerId = userRow.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const name =
        [userRow.firstName, userRow.lastName].filter(Boolean).join(" ") ||
        session.user.email;
      stripeCustomerId = await getOrCreateStripeCustomer(
        session.user.email,
        name,
      );
      await db
        .update(authUserTable)
        .set({ stripeCustomerId })
        .where(eq(authUser.id, session.user.id));
    }

    const orderId = crypto.randomUUID();

    // 6. Run pricing + writes in a single transaction. Promotion rows are locked
    //    FOR UPDATE so concurrent orders cannot oversell a limited promotion.
    type LineComputed = {
      dishId: string;
      dishName: string;
      quantity: number;
      priceSnapshot: number;
      promotionId: string | null;
      discountAmount: number;
      lineTotal: number;
    };

    let subtotal = 0;
    let deliveryFeeSnapshot = 0;
    let deliveryDistanceKm = 0;

    // ── Pricing (optimistic, no locks) ───────────────────────────────────────
    // Validate promotions with a plain read so we can compute the total and
    // create the PaymentIntent BEFORE opening a write transaction. The promos
    // are re-checked under FOR UPDATE at commit time to prevent overselling, so
    // no external call ever runs while a row lock is held.
    const computed: LineComputed[] = [];
    for (const line of lines) {
      const dish = dishById.get(line.dishId);
      if (!dish) throw new Error("dish vanished");
      const price = Number.parseFloat(dish.price);

      let promo: {
        type: "percentage_off" | "fixed_off";
        value: number;
      } | null = null;
      let promotionId: string | null = null;
      if (line.promotionId) {
        const [row] = await db
          .select({
            id: dishPromotions.id,
            type: dishPromotions.type,
            value: dishPromotions.value,
            isActive: dishPromotions.isActive,
            validFrom: dishPromotions.validFrom,
            validUntil: dishPromotions.validUntil,
            maxUses: dishPromotions.maxUses,
            usesCount: dishPromotions.usesCount,
          })
          .from(dishPromotions)
          .where(
            and(
              eq(dishPromotions.id, line.promotionId),
              eq(dishPromotions.dishId, line.dishId),
            ),
          )
          .limit(1);

        const now = new Date();
        const valid =
          row &&
          row.isActive &&
          (!row.validFrom || row.validFrom <= now) &&
          (!row.validUntil || row.validUntil > now) &&
          (row.maxUses == null || row.usesCount < row.maxUses);
        if (!valid) {
          return NextResponse.json(
            {
              error: "A selected promotion is no longer valid.",
              dishId: line.dishId,
            },
            { status: 422 },
          );
        }
        promo = {
          type: row.type as "percentage_off" | "fixed_off",
          value: Number.parseFloat(row.value),
        };
        promotionId = row.id;
      }

      const { discountAmount, lineTotal } = computeLineTotal(
        price,
        line.quantity,
        promo,
      );
      subtotal += lineTotal;
      computed.push({
        dishId: line.dishId,
        dishName: dish.name,
        quantity: line.quantity,
        priceSnapshot: price,
        promotionId,
        discountAmount,
        lineTotal,
      });
    }

    // Delivery fee snapshot (external call, outside any transaction).
    const wantsDelivery =
      fulfillmentMode === "delivery" &&
      cook.delivery === "self" &&
      customerLat != null &&
      customerLng != null &&
      cook.pickupLat != null &&
      cook.pickupLng != null;
    if (wantsDelivery) {
      try {
        const distKm = await getDrivingDistanceKm(
          cook.pickupLat as number,
          cook.pickupLng as number,
          customerLat as number,
          customerLng as number,
        );
        const feeResult = calcDeliveryFee(
          {
            maxDeliveryKm: cook.maxDeliveryKm,
            deliveryRatePerKm: cook.deliveryRatePerKm,
            deliveryFlatFee: cook.deliveryFlatFee,
            freeDeliveryAbove: cook.freeDeliveryAbove,
          },
          distKm,
          subtotal,
        );
        deliveryFeeSnapshot = feeResult.fee;
        deliveryDistanceKm = Math.round(distKm);
      } catch (e) {
        console.error("[orders/POST] delivery fee", e);
      }
    }

    const totalPrice = Math.round((subtotal + deliveryFeeSnapshot) * 100) / 100;
    const totalCents = Math.round(totalPrice * 100);
    const platformFeePct = Number.parseFloat(cook.platformFeePct);
    const platformFeeCents = Math.round((totalCents * platformFeePct) / 100);
    const cookPayoutCents = totalCents - platformFeeCents;

    // ── Create the off-session PaymentIntent BEFORE the DB transaction ────────
    let piId: string | null = null;
    try {
      const pi = await createFullPaymentIntent({
        totalAmountCents: totalCents,
        platformFeeCents,
        stripeCustomerId: stripeCustomerId as string,
        paymentMethodId,
        connectedAccountId: cook.stripeAccountId as string,
        idempotencyKey: `full-${orderId}`,
      });
      piId = pi.piId;
    } catch (stripeErr) {
      console.error("[orders/POST] stripe", stripeErr);
      return NextResponse.json(
        { error: "Payment could not be authorized." },
        { status: 502 },
      );
    }

    // ── Short write transaction: re-lock promos, insert, increment usesCount ──
    try {
      await dbPool.transaction(async (tx) => {
        // Re-validate each promo under a row lock to prevent concurrent
        // overselling between the optimistic read and the commit.
        for (const c of computed) {
          if (!c.promotionId) continue;
          const [row] = await tx
            .select({
              isActive: dishPromotions.isActive,
              validFrom: dishPromotions.validFrom,
              validUntil: dishPromotions.validUntil,
              maxUses: dishPromotions.maxUses,
              usesCount: dishPromotions.usesCount,
            })
            .from(dishPromotions)
            .where(eq(dishPromotions.id, c.promotionId))
            .for("update")
            .limit(1);
          const now = new Date();
          const stillValid =
            row &&
            row.isActive &&
            (!row.validFrom || row.validFrom <= now) &&
            (!row.validUntil || row.validUntil > now) &&
            (row.maxUses == null || row.usesCount < row.maxUses);
          if (!stillValid) {
            const err = new Error("PROMO_INVALID");
            (err as { dishId?: string }).dishId = c.dishId;
            throw err;
          }
        }

        await tx.insert(orders).values({
          id: orderId as `${string}-${string}-${string}-${string}-${string}`,
          clientId: session.user.id,
          cookId,
          status: "pending",
          cancellationAllowed: cook.cancellationAllowed,
          totalPrice: String(totalPrice.toFixed(2)),
          currency: "CAD",
          pickupAt: new Date(pickupAt),
          deliveryAddress: deliveryAddress ?? null,
          fulfillmentMode: fulfillmentMode ?? null,
          deliveryFeeSnapshot:
            deliveryFeeSnapshot > 0
              ? String(deliveryFeeSnapshot.toFixed(2))
              : null,
          deliveryDistanceKm:
            deliveryDistanceKm > 0 ? deliveryDistanceKm : null,
          notes: notes ?? null,
        });

        await tx.insert(orderDishes).values(
          computed.map((c, i) => ({
            orderId,
            dishId: c.dishId,
            dishName: c.dishName,
            quantity: c.quantity,
            priceSnapshot: String(c.priceSnapshot.toFixed(2)),
            promotionId: c.promotionId,
            discountAmount:
              c.discountAmount > 0 ? String(c.discountAmount.toFixed(2)) : null,
            lineTotal: String(c.lineTotal.toFixed(2)),
            sortOrder: i,
          })),
        );

        await tx.insert(orderPayments).values({
          orderId,
          cookId,
          clientId: session.user.id,
          type: "full",
          status: "authorized",
          totalAmount: String(totalPrice.toFixed(2)),
          platformFeePct: cook.platformFeePct,
          platformFeeAmount: String((platformFeeCents / 100).toFixed(2)),
          cookPayoutAmount: String((cookPayoutCents / 100).toFixed(2)),
          currency: "CAD",
          stripePaymentIntentId: piId,
          authorizedAt: new Date(),
        });

        for (const c of computed) {
          if (c.promotionId) {
            await tx
              .update(dishPromotions)
              .set({ usesCount: sql`${dishPromotions.usesCount} + 1` })
              .where(eq(dishPromotions.id, c.promotionId));
          }
        }
      });
    } catch (txErr) {
      // Roll back the authorized payment so the client is never charged for a
      // failed write.
      if (piId) {
        await cancelPaymentIntent(piId, `cancel-${orderId}`).catch(() => {});
      }
      if ((txErr as Error).message === "PROMO_INVALID") {
        return NextResponse.json(
          {
            error: "A selected promotion is no longer valid.",
            dishId: (txErr as { dishId?: string }).dishId,
          },
          { status: 422 },
        );
      }
      throw txErr;
    }

    // Notify the cook (fire-and-forget) with the dish names.
    db.select({ email: authUser.email, firstName: authUser.firstName })
      .from(cookProfiles)
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(eq(cookProfiles.id, cookId))
      .limit(1)
      .then(([cookUser]) => {
        if (!cookUser) return;
        const customerName =
          session.user.name ||
          [session.user.firstName, session.user.lastName]
            .filter(Boolean)
            .join(" ") ||
          "A customer";
        return sendOrderPlacedEmailToCook(
          { email: cookUser.email, firstName: cookUser.firstName },
          { name: customerName },
          {
            id: orderId,
            listingTitle: computed.map((c) => c.dishName).join(", "),
            quantity: totalQty,
            totalPrice: String((subtotal + deliveryFeeSnapshot).toFixed(2)),
            currency: "CAD",
            pickupAt: new Date(pickupAt),
          },
        );
      })
      .catch((err) => console.error("[orders/POST] email", err));

    // Send the client an order receipt (fire-and-forget).
    sendOrderReceiptToClient(
      { email: session.user.email, firstName: session.user.firstName ?? null },
      { name: cook.displayName ?? "your cook" },
      {
        id: orderId,
        listingTitle: computed.map((c) => c.dishName).join(", "),
        quantity: totalQty,
        totalPrice: String((subtotal + deliveryFeeSnapshot).toFixed(2)),
        currency: "CAD",
        pickupAt: new Date(pickupAt),
      },
    ).catch((err) => console.error("[orders/POST] receipt", err));

    return NextResponse.json(
      { success: true, data: { orderId } },
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
