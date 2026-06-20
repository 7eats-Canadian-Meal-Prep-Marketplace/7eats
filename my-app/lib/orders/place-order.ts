import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, dbPool } from "@/db";
import {
  authUser,
  cookProfiles,
  dishes,
  dishPromotions,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { calcDeliveryFee } from "@/lib/delivery-fee";
import {
  sendGuestOrderReceiptToClient,
  sendOrderPlacedEmailToCook,
  sendOrderReceiptToClient,
} from "@/lib/emails/order-events";
import { getDrivingDistanceKm } from "@/lib/mapbox-directions";
import { computeLineTotal } from "@/lib/order-pricing";
import {
  cancelPaymentIntent,
  createFullPaymentIntent,
} from "@/lib/stripe-payments";

export const orderLineSchema = z.object({
  dishId: z.string().uuid(),
  quantity: z.number().int().min(1),
  promotionId: z.string().uuid().nullable().optional(),
});

export const createOrderBodySchema = z.object({
  cookId: z.string().uuid(),
  dishes: z.array(orderLineSchema).min(1),
  paymentMethodId: z.string().min(1),
  pickupAt: z.string().datetime().optional(),
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

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

export type PlaceOrderClient = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  stripeCustomerId: string;
};

export type GuestOrderMeta = {
  confirmationCode: string;
  guestAccessTokenHash: string;
  accessToken: string;
};

export type PlaceOrderResult =
  | { ok: true; orderId: string; guest?: GuestOrderMeta }
  | { ok: false; status: number; error: string; dishId?: string };

export async function placeClientOrder(
  client: PlaceOrderClient,
  body: CreateOrderBody,
  guestMeta?: Omit<GuestOrderMeta, "accessToken"> & { accessToken?: string },
): Promise<PlaceOrderResult> {
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
  } = body;

  const [cook] = await db
    .select({
      id: cookProfiles.id,
      displayName: cookProfiles.displayName,
      userStatus: authUser.status,
      minOrderQty: cookProfiles.minOrderQty,
      maxOrderQty: cookProfiles.maxOrderQty,
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
    return { ok: false, status: 404, error: "Cook not found." };
  }
  if (!cook.stripeAccountId) {
    return {
      ok: false,
      status: 400,
      error: "Cook payment account not connected.",
    };
  }

  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  if (totalQty < cook.minOrderQty) {
    return {
      ok: false,
      status: 422,
      error: `Minimum order is ${cook.minOrderQty} item(s).`,
    };
  }
  if (cook.maxOrderQty != null && totalQty > cook.maxOrderQty) {
    return {
      ok: false,
      status: 422,
      error: `Maximum order is ${cook.maxOrderQty} item(s).`,
    };
  }

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
      return {
        ok: false,
        status: 422,
        error: "One or more dishes are unavailable.",
      };
    }
  }

  const orderId = crypto.randomUUID();

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
        !!row &&
        row.isActive &&
        (!row.validFrom || row.validFrom <= now) &&
        (!row.validUntil || row.validUntil > now) &&
        (row.maxUses == null || row.usesCount < row.maxUses);
      if (!row || !valid) {
        return {
          ok: false,
          status: 422,
          error: "A selected promotion is no longer valid.",
          dishId: line.dishId,
        };
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
      console.error("[placeClientOrder] delivery fee", e);
    }
  }

  const totalPrice = Math.round((subtotal + deliveryFeeSnapshot) * 100) / 100;
  const totalCents = Math.round(totalPrice * 100);
  const platformFeePct = Number.parseFloat(cook.platformFeePct);
  const platformFeeCents = Math.round((totalCents * platformFeePct) / 100);
  const cookPayoutCents = totalCents - platformFeeCents;

  let piId: string | null = null;
  try {
    const pi = await createFullPaymentIntent({
      totalAmountCents: totalCents,
      platformFeeCents,
      stripeCustomerId: client.stripeCustomerId,
      paymentMethodId,
      connectedAccountId: cook.stripeAccountId as string,
      idempotencyKey: `full-${orderId}`,
    });
    piId = pi.piId;
  } catch (stripeErr) {
    console.error("[placeClientOrder] stripe", stripeErr);
    return {
      ok: false,
      status: 502,
      error: "Payment could not be authorized.",
    };
  }

  const isGuestCheckout = Boolean(guestMeta);

  try {
    await dbPool.transaction(async (tx) => {
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
          !!row &&
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
        clientId: client.id,
        cookId,
        status: "pending",
        cancellationAllowed: cook.cancellationAllowed,
        totalPrice: String(totalPrice.toFixed(2)),
        currency: "CAD",
        pickupAt: pickupAt ? new Date(pickupAt) : null,
        deliveryAddress: deliveryAddress ?? null,
        fulfillmentMode: fulfillmentMode ?? null,
        deliveryFeeSnapshot:
          deliveryFeeSnapshot > 0
            ? String(deliveryFeeSnapshot.toFixed(2))
            : null,
        deliveryDistanceKm: deliveryDistanceKm > 0 ? deliveryDistanceKm : null,
        notes: notes ?? null,
        confirmationCode: guestMeta?.confirmationCode ?? null,
        guestAccessTokenHash: guestMeta?.guestAccessTokenHash ?? null,
        isGuestCheckout,
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
        clientId: client.id,
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
    if (piId) {
      await cancelPaymentIntent(piId, `cancel-${orderId}`).catch(() => {});
    }
    if ((txErr as Error).message === "PROMO_INVALID") {
      return {
        ok: false,
        status: 422,
        error: "A selected promotion is no longer valid.",
        dishId: (txErr as { dishId?: string }).dishId,
      };
    }
    throw txErr;
  }

  const listingTitle = computed.map((c) => c.dishName).join(", ");
  const orderEmailPayload = {
    id: orderId,
    listingTitle,
    quantity: totalQty,
    totalPrice: String((subtotal + deliveryFeeSnapshot).toFixed(2)),
    currency: "CAD" as const,
    pickupAt: pickupAt ? new Date(pickupAt) : null,
    fulfillmentMode: fulfillmentMode ?? null,
  };

  db.select({ email: authUser.email, firstName: authUser.firstName })
    .from(cookProfiles)
    .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
    .where(eq(cookProfiles.id, cookId))
    .limit(1)
    .then(([cookUser]) => {
      if (!cookUser) return;
      return sendOrderPlacedEmailToCook(
        { email: cookUser.email, firstName: cookUser.firstName },
        { name: client.displayName },
        orderEmailPayload,
      );
    })
    .catch((err) => console.error("[placeClientOrder] cook email", err));

  if (guestMeta?.accessToken) {
    sendGuestOrderReceiptToClient(
      {
        email: client.email,
        firstName: client.firstName,
      },
      { name: cook.displayName ?? "your cook" },
      {
        ...orderEmailPayload,
        cancellationAllowed: cook.cancellationAllowed,
      },
      {
        confirmationCode: guestMeta.confirmationCode,
        accessToken: guestMeta.accessToken,
      },
    ).catch((err) => console.error("[placeClientOrder] guest receipt", err));
  } else {
    sendOrderReceiptToClient(
      { email: client.email, firstName: client.firstName },
      { name: cook.displayName ?? "your cook" },
      orderEmailPayload,
    ).catch((err) => console.error("[placeClientOrder] receipt", err));
  }

  return {
    ok: true,
    orderId,
    guest: guestMeta?.accessToken
      ? {
          confirmationCode: guestMeta.confirmationCode,
          guestAccessTokenHash: guestMeta.guestAccessTokenHash,
          accessToken: guestMeta.accessToken,
        }
      : undefined,
  };
}
