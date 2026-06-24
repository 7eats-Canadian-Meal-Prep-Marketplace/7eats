import { and, eq, gte, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles, orderDishes, orders } from "@/db/schema";

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

// ISO week number for the current date
function getCurrentISOWeek(): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

const querySchema = z.object({
  period: z.enum(["week", "month"]).default("month"),
  year: z.coerce.number().int().min(2000).max(2100).default(currentYear),
  month: z.coerce.number().int().min(1).max(12).default(currentMonth),
  week: z.coerce.number().int().min(1).max(53).default(getCurrentISOWeek()),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    week: searchParams.get("week") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query params." },
      { status: 400 },
    );
  }

  const { period, year, month, week } = parsed.data;

  // Compute date range boundaries
  let startDate: Date;
  let endDate: Date;

  if (period === "month") {
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 1);
  } else {
    // ISO week: find the Monday of the requested week in the given year
    // Jan 4 is always in week 1 per ISO 8601
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // 0=Mon
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - jan4DayOfWeek);
    startDate = new Date(week1Monday);
    startDate.setDate(week1Monday.getDate() + (week - 1) * 7);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
  }

  try {
    // Fetch platform fee and fulfilled orders with listing titles in parallel
    const [cookProfile, rawOrders, dishLines] = await Promise.all([
      db
        .select({ platformFeePct: cookProfiles.platformFeePct })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1),

      // Order-level totals (the real money, including any delivery fee).
      // Bucketed by fulfillment time — `pickupAt` is null for pickup orders.
      db
        .select({ id: orders.id, totalPrice: orders.totalPrice })
        .from(orders)
        .where(
          and(
            eq(orders.cookId, cookId),
            eq(orders.status, "fulfilled"),
            gte(orders.fulfilledAt, startDate),
            lte(orders.fulfilledAt, endDate),
          ),
        ),

      // Per-dish breakdown from the order line items.
      db
        .select({
          dishName: orderDishes.dishName,
          lineTotal: orderDishes.lineTotal,
        })
        .from(orderDishes)
        .innerJoin(orders, eq(orderDishes.orderId, orders.id))
        .where(
          and(
            eq(orders.cookId, cookId),
            eq(orders.status, "fulfilled"),
            gte(orders.fulfilledAt, startDate),
            lte(orders.fulfilledAt, endDate),
          ),
        ),
    ]);

    const platformFeePct = Number(cookProfile[0]?.platformFeePct ?? 0);

    let summaryGross = 0;
    for (const o of rawOrders) summaryGross += Number(o.totalPrice);
    const summaryOrderCount = rawOrders.length;

    // Aggregate the breakdown by dish name.
    const dishMap = new Map<
      string,
      { dishName: string; orderCount: number; gross: number }
    >();
    for (const row of dishLines) {
      const gross = Number(row.lineTotal);
      const existing = dishMap.get(row.dishName);
      if (existing) {
        existing.orderCount += 1;
        existing.gross += gross;
      } else {
        dishMap.set(row.dishName, {
          dishName: row.dishName,
          orderCount: 1,
          gross,
        });
      }
    }

    const summaryPlatformFee = summaryGross * (platformFeePct / 100);
    const summaryNet = summaryGross - summaryPlatformFee;

    // Response key kept as `byListing` for the existing earnings UI; entries now
    // describe dishes (listingTitle = dish name).
    const byListing = Array.from(dishMap.values()).map((entry) => {
      const platformFee = entry.gross * (platformFeePct / 100);
      const net = entry.gross - platformFee;
      return {
        listingId: entry.dishName,
        listingTitle: entry.dishName,
        orderCount: entry.orderCount,
        gross: entry.gross,
        platformFee,
        net,
      };
    });

    const periodMeta =
      period === "month"
        ? { type: period, year, month }
        : { type: period, year, week };

    return NextResponse.json({
      success: true,
      data: {
        period: periodMeta,
        summary: {
          gross: summaryGross,
          platformFee: summaryPlatformFee,
          net: summaryNet,
          orderCount: summaryOrderCount,
        },
        byListing,
      },
    });
  } catch (err) {
    console.error("[dashboard/earnings]", err);
    return NextResponse.json(
      { error: "Failed to fetch earnings." },
      { status: 500 },
    );
  }
}
