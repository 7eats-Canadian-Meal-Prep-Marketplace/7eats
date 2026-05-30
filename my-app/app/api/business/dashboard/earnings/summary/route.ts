import { and, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles, orders } from "@/db/schema";

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [
      allTimeResult,
      thisMonthResult,
      thisWeekResult,
      pendingReleaseResult,
      cookProfile,
    ] = await Promise.all([
      // All-time fulfilled
      db
        .select({ total: sum(orders.totalPrice) })
        .from(orders)
        .where(and(eq(orders.cookId, cookId), eq(orders.status, "fulfilled"))),

      // This calendar month fulfilled
      db
        .select({ total: sum(orders.totalPrice) })
        .from(orders)
        .where(
          and(
            eq(orders.cookId, cookId),
            eq(orders.status, "fulfilled"),
            gte(orders.pickupAt, sql`date_trunc('month', now())`),
            lte(
              orders.pickupAt,
              sql`date_trunc('month', now()) + interval '1 month'`,
            ),
          ),
        ),

      // This ISO week fulfilled
      db
        .select({ total: sum(orders.totalPrice) })
        .from(orders)
        .where(
          and(
            eq(orders.cookId, cookId),
            eq(orders.status, "fulfilled"),
            gte(orders.pickupAt, sql`date_trunc('week', now())`),
            lte(
              orders.pickupAt,
              sql`date_trunc('week', now()) + interval '7 days'`,
            ),
          ),
        ),

      // Pending release: confirmed + ready (earned but not yet released)
      db
        .select({ total: sum(orders.totalPrice) })
        .from(orders)
        .where(
          and(
            eq(orders.cookId, cookId),
            inArray(orders.status, ["confirmed", "ready"]),
          ),
        ),

      // Cook's current platform fee percentage
      db
        .select({ platformFeePct: cookProfiles.platformFeePct })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        allTime: Number(allTimeResult[0]?.total ?? 0),
        thisMonth: Number(thisMonthResult[0]?.total ?? 0),
        thisWeek: Number(thisWeekResult[0]?.total ?? 0),
        pendingRelease: Number(pendingReleaseResult[0]?.total ?? 0),
        platformFeePct: Number(cookProfile[0]?.platformFeePct ?? 0),
      },
    });
  } catch (err) {
    console.error("[dashboard/earnings/summary]", err);
    return NextResponse.json(
      { error: "Failed to fetch earnings summary." },
      { status: 500 },
    );
  }
}
