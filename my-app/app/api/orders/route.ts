import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, dbPool } from "@/db";
import {
  authUser,
  cookProfiles,
  dishes,
  listingDishes,
  listingPromotions,
  listings,
  orderDishes,
  orderPayments,
  orders,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  cancelPaymentIntent,
  createFullPaymentIntent,
} from "@/lib/stripe-payments";
import { getOrCreateStripeCustomer } from "@/lib/stripe-subscriptions";

const VALID_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "ready",
  "fulfilled",
  "cancelled",
] as const;
type OrderStatusValue = (typeof VALID_ORDER_STATUSES)[number];

type DishEntry = {
  id: string;
  dishName: string;
  quantity: number;
  sortOrder: number;
};

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
        listingTitle: listings.title,
        quantity: orders.quantity,
        unitPrice: orders.unitPrice,
        totalPrice: orders.totalPrice,
        currency: orders.currency,
        pickupAt: orders.pickupAt,
        notes: orders.notes,
        createdAt: orders.createdAt,
        pickupCode: orders.pickupCode,
      })
      .from(orders)
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const orderIds = rows.map((r) => r.id);
    const dishRows =
      orderIds.length > 0
        ? await db
            .select({
              orderId: orderDishes.orderId,
              id: orderDishes.id,
              dishName: orderDishes.dishName,
              quantity: orderDishes.quantity,
              sortOrder: orderDishes.sortOrder,
            })
            .from(orderDishes)
            .where(inArray(orderDishes.orderId, orderIds))
        : [];

    // Biome's noAccumulatingSpread rule disallows spread inside reduce accumulators,
    // so we use a for-of loop with mutation scoped to a local variable instead.
    const dishesByOrderId: Record<string, DishEntry[]> = {};
    for (const d of dishRows) {
      if (!dishesByOrderId[d.orderId]) {
        dishesByOrderId[d.orderId] = [];
      }
      dishesByOrderId[d.orderId].push({
        id: d.id,
        dishName: d.dishName,
        quantity: d.quantity,
        sortOrder: d.sortOrder,
      });
    }

    const data = rows.map((r) => ({
      id: r.id,
      status: r.status,
      listingTitle: r.listingTitle ?? null,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      totalPrice: r.totalPrice,
      currency: r.currency,
      pickupAt:
        r.pickupAt instanceof Date ? r.pickupAt.toISOString() : r.pickupAt,
      notes: r.notes ?? null,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      pickupCode: r.status === "ready" ? (r.pickupCode ?? null) : null,
      dishes: dishesByOrderId[r.id] ?? [],
    }));

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

const createOrderSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.number().int().min(1),
  paymentMethodId: z.string().min(1),
  pickupAt: z.string().datetime(),
  promotionId: z.string().uuid().optional(),
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

  const { listingId, quantity, paymentMethodId, pickupAt, promotionId, notes } =
    parsed.data;

  try {
    const [listing] = await db
      .select({
        id: listings.id,
        cookId: listings.cookId,
        type: listings.type,
        status: listings.status,
        basePrice: listings.basePrice,
        minOrderQty: listings.minOrderQty,
        maxOrderQty: listings.maxOrderQty,
        depositEnabled: listings.depositEnabled,
        depositType: listings.depositType,
        depositValue: listings.depositValue,
      })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.status, "active")))
      .limit(1);

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    }
    if (listing.type !== "one_time") {
      return NextResponse.json(
        { error: "This listing is subscription-only." },
        { status: 400 },
      );
    }
    if (quantity < listing.minOrderQty) {
      return NextResponse.json(
        { error: `Minimum order quantity is ${listing.minOrderQty}.` },
        { status: 400 },
      );
    }
    if (listing.maxOrderQty !== null && quantity > listing.maxOrderQty) {
      return NextResponse.json(
        { error: `Maximum order quantity is ${listing.maxOrderQty}.` },
        { status: 400 },
      );
    }

    const [cook] = await db
      .select({
        stripeAccountId: cookProfiles.stripeAccountId,
        platformFeePct: cookProfiles.platformFeePct,
      })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, listing.cookId))
      .limit(1);

    if (!cook?.stripeAccountId) {
      return NextResponse.json(
        { error: "Cook payment account not connected." },
        { status: 400 },
      );
    }

    // Promotion
    let discountAmount = 0;
    let validatedPromotionId: string | null = null;
    if (promotionId) {
      const [promo] = await db
        .select({
          id: listingPromotions.id,
          type: listingPromotions.type,
          value: listingPromotions.value,
          maxUses: listingPromotions.maxUses,
          usesCount: listingPromotions.usesCount,
          validFrom: listingPromotions.validFrom,
          validUntil: listingPromotions.validUntil,
        })
        .from(listingPromotions)
        .where(
          and(
            eq(listingPromotions.id, promotionId),
            eq(listingPromotions.listingId, listingId),
            eq(listingPromotions.isActive, true),
          ),
        )
        .limit(1);

      if (!promo) {
        return NextResponse.json(
          { error: "Promotion not found or inactive." },
          { status: 400 },
        );
      }
      const now = new Date();
      if (promo.validFrom && new Date(promo.validFrom) > now) {
        return NextResponse.json(
          { error: "Promotion not yet active." },
          { status: 400 },
        );
      }
      if (promo.validUntil && new Date(promo.validUntil) <= now) {
        return NextResponse.json(
          { error: "Promotion has expired." },
          { status: 400 },
        );
      }
      if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
        return NextResponse.json(
          { error: "Promotion usage limit reached." },
          { status: 400 },
        );
      }
      const unitPriceForPromo = parseFloat(listing.basePrice);
      if (promo.type === "percentage_off") {
        discountAmount = Math.min(
          (unitPriceForPromo * quantity * parseFloat(promo.value ?? "0")) / 100,
          unitPriceForPromo * quantity,
        );
      } else if (promo.type === "fixed_off") {
        discountAmount = Math.min(
          parseFloat(promo.value ?? "0"),
          unitPriceForPromo * quantity,
        );
      }
      validatedPromotionId = promo.id;
    }

    // Compute totals
    const unitPrice = parseFloat(listing.basePrice);
    const totalPrice = Math.max(0, unitPrice * quantity - discountAmount);
    const totalPriceCents = Math.round(totalPrice * 100);
    const platformFeePct = parseFloat(cook.platformFeePct);
    const totalPlatformFeeCents = Math.round(
      (totalPriceCents * platformFeePct) / 100,
    );
    const cookPayoutCents = totalPriceCents - totalPlatformFeeCents;

    // Deposit
    let depositAmountCents = 0;
    let depositAmount = 0;
    if (listing.depositEnabled && listing.depositValue) {
      const depositVal = parseFloat(listing.depositValue);
      depositAmount =
        listing.depositType === "percentage"
          ? Math.min((totalPrice * depositVal) / 100, totalPrice)
          : Math.min(depositVal, totalPrice);
      depositAmountCents = Math.round(depositAmount * 100);
    }

    // Stripe customer
    const [userRow] = await db
      .select({
        stripeCustomerId: authUser.stripeCustomerId,
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
      })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    let stripeCustomerId = userRow?.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const name =
        [userRow?.firstName, userRow?.lastName].filter(Boolean).join(" ") ||
        session.user.email;
      stripeCustomerId = await getOrCreateStripeCustomer(
        session.user.email,
        name,
      );
      await db
        .update(authUser)
        .set({ stripeCustomerId })
        .where(eq(authUser.id, session.user.id));
    }

    // Pre-generate order ID for idempotency keys
    const orderId = crypto.randomUUID();

    // Create Stripe PI(s)
    let fullPiId: string | null = null;
    let depositPiId: string | null = null;
    let balancePiId: string | null = null;

    try {
      if (depositAmountCents === 0) {
        const result = await createFullPaymentIntent({
          totalAmountCents: totalPriceCents,
          platformFeeCents: totalPlatformFeeCents,
          stripeCustomerId,
          paymentMethodId,
          connectedAccountId: cook.stripeAccountId,
          idempotencyKey: `full-${orderId}`,
        });
        fullPiId = result.piId;
      } else {
        const balanceAmountCents = totalPriceCents - depositAmountCents;
        const depositPlatformFeeCents = Math.round(
          (totalPlatformFeeCents * depositAmountCents) / totalPriceCents,
        );
        const balancePlatformFeeCents =
          totalPlatformFeeCents - depositPlatformFeeCents;
        // Create deposit PI first so its ID is available for cleanup on failure
        const depositResult = await createFullPaymentIntent({
          totalAmountCents: depositAmountCents,
          platformFeeCents: depositPlatformFeeCents,
          stripeCustomerId,
          paymentMethodId,
          connectedAccountId: cook.stripeAccountId,
          idempotencyKey: `deposit-${orderId}`,
        });
        depositPiId = depositResult.piId;
        // Only create balance PI after deposit succeeds
        try {
          const balanceResult = await createFullPaymentIntent({
            totalAmountCents: balanceAmountCents,
            platformFeeCents: balancePlatformFeeCents,
            stripeCustomerId,
            paymentMethodId,
            connectedAccountId: cook.stripeAccountId,
            idempotencyKey: `balance-${orderId}`,
          });
          balancePiId = balanceResult.piId;
        } catch (balanceErr) {
          // Balance PI failed — cancel the already-authorized deposit PI before re-throwing
          await cancelPaymentIntent(
            depositPiId,
            `cancel-deposit-on-balance-fail-${orderId}`,
          ).catch(() => {});
          throw balanceErr;
        }
      }
    } catch (stripeErr) {
      // Any Stripe PI creation failure — clean up any authorized PIs
      const toCancel = [fullPiId, depositPiId, balancePiId].filter(
        (id): id is string => id !== null,
      );
      await Promise.allSettled(
        toCancel.map((id) =>
          cancelPaymentIntent(id, `cancel-stripe-err-${orderId}-${id}`).catch(
            () => {},
          ),
        ),
      );
      throw stripeErr;
    }

    // DB transaction
    try {
      await dbPool.transaction(async (tx) => {
        await tx.insert(orders).values({
          id: orderId as `${string}-${string}-${string}-${string}-${string}`,
          clientId: session.user.id,
          listingId,
          cookId: listing.cookId,
          status: "pending",
          quantity,
          unitPrice: String(unitPrice),
          promotionId: validatedPromotionId,
          discountAmount:
            discountAmount > 0 ? String(discountAmount.toFixed(2)) : null,
          totalPrice: String(totalPrice.toFixed(2)),
          currency: "CAD",
          pickupAt: new Date(pickupAt),
          notes: notes ?? null,
          depositEnabled: listing.depositEnabled,
          depositType: listing.depositType ?? null,
          depositValue: listing.depositValue ?? null,
          depositAmount:
            depositAmount > 0 ? String(depositAmount.toFixed(2)) : null,
        });

        const listingDishRows = await tx
          .select({
            dishId: listingDishes.dishId,
            quantity: listingDishes.quantity,
            sortOrder: listingDishes.sortOrder,
            dishName: dishes.name,
          })
          .from(listingDishes)
          .innerJoin(dishes, eq(listingDishes.dishId, dishes.id))
          .where(eq(listingDishes.listingId, listingId));

        if (listingDishRows.length > 0) {
          await tx.insert(orderDishes).values(
            listingDishRows.map((d) => ({
              orderId,
              dishId: d.dishId,
              dishName: d.dishName,
              quantity: d.quantity,
              sortOrder: d.sortOrder,
            })),
          );
        }

        if (fullPiId) {
          await tx.insert(orderPayments).values({
            orderId,
            cookId: listing.cookId,
            clientId: session.user.id,
            type: "full",
            status: "authorized",
            totalAmount: String(totalPrice.toFixed(2)),
            platformFeePct: cook.platformFeePct,
            platformFeeAmount: String((totalPlatformFeeCents / 100).toFixed(2)),
            cookPayoutAmount: String((cookPayoutCents / 100).toFixed(2)),
            currency: "CAD",
            stripePaymentIntentId: fullPiId,
            authorizedAt: new Date(),
          });
        }

        if (depositPiId && balancePiId) {
          const depPlatFee = Math.round(
            (totalPlatformFeeCents * depositAmountCents) / totalPriceCents,
          );
          const balPlatFee = totalPlatformFeeCents - depPlatFee;
          const balAmtCents = totalPriceCents - depositAmountCents;

          await tx.insert(orderPayments).values([
            {
              orderId,
              cookId: listing.cookId,
              clientId: session.user.id,
              type: "deposit",
              status: "authorized",
              totalAmount: String((depositAmountCents / 100).toFixed(2)),
              platformFeePct: cook.platformFeePct,
              platformFeeAmount: String((depPlatFee / 100).toFixed(2)),
              cookPayoutAmount: String(
                ((depositAmountCents - depPlatFee) / 100).toFixed(2),
              ),
              currency: "CAD",
              stripePaymentIntentId: depositPiId,
              authorizedAt: new Date(),
            },
            {
              orderId,
              cookId: listing.cookId,
              clientId: session.user.id,
              type: "balance",
              status: "authorized",
              totalAmount: String((balAmtCents / 100).toFixed(2)),
              platformFeePct: cook.platformFeePct,
              platformFeeAmount: String((balPlatFee / 100).toFixed(2)),
              cookPayoutAmount: String(
                ((balAmtCents - balPlatFee) / 100).toFixed(2),
              ),
              currency: "CAD",
              stripePaymentIntentId: balancePiId,
              authorizedAt: new Date(),
            },
          ]);
        }

        // Increment promotion usage count atomically
        if (validatedPromotionId) {
          await tx
            .update(listingPromotions)
            .set({ usesCount: sql`${listingPromotions.usesCount} + 1` })
            .where(eq(listingPromotions.id, validatedPromotionId));
        }
      });
    } catch (dbErr) {
      const cancels = [fullPiId, depositPiId, balancePiId]
        .filter((id): id is string => id !== null)
        .map((id) =>
          cancelPaymentIntent(id, `cancel-${orderId}-${id}`).catch(() => {}),
        );
      await Promise.allSettled(cancels);
      throw dbErr;
    }

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
