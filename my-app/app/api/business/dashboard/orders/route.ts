import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { authUser, listings, orders } from "@/db/schema";

const querySchema = z.object({
  status: z
    .enum(["pending", "confirmed", "ready", "fulfilled", "cancelled"])
    .optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query parameters." },
      { status: 400 },
    );
  }

  const { status, dateFrom, dateTo, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.cookId, cookId)];
  if (status) conditions.push(eq(orders.status, status));
  if (dateFrom) conditions.push(gte(orders.pickupAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(orders.pickupAt, new Date(dateTo)));

  const where = and(...conditions);

  try {
    const [rows, totalResult] = await Promise.all([
      db
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
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),

      db.select({ total: count() }).from(orders).where(where),
    ]);

    const total = Number(totalResult[0]?.total ?? 0);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { total, page, limit },
    });
  } catch (err) {
    console.error("[dashboard/orders]", err);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 },
    );
  }
}
