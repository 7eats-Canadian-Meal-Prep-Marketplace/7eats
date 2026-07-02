import { and, count, eq, gte, inArray, lte, ne, sql, sum } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { dishes, orderPayments, orders, reviews } from "@/db/schema";
import { orderHasPlacedPaymentFilter } from "@/lib/orders/abandoned-checkout";

// Cook earnings reflect the net payout (total − platform fee − tax) snapshotted
// on order_payments, not the gross `orders.totalPrice` the customer paid.
const fullPaymentJoin = and(
  eq(orderPayments.orderId, orders.id),
  eq(orderPayments.type, "full"),
  ne(orderPayments.status, "pending"),
);

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [
      orderCounts,
      earningsThisWeek,
      earningsThisMonth,
      earningsAllTime,
      earningsPending,
      activeMealsCount,
      ratingStats,
    ] = await Promise.all([
      // Order counts by status (pending, confirmed, ready)
      db
        .select({ status: orders.status, count: count() })
        .from(orders)
        .where(
          and(
            eq(orders.cookId, cookId),
            orderHasPlacedPaymentFilter(),
            inArray(orders.status, [
              "pending",
              "confirmed",
              "ready",
              "fulfilled",
            ]),
          ),
        )
        .groupBy(orders.status),

      // Net earnings this ISO week (fulfilled orders, by fulfillment time)
      db
        .select({ total: sum(orderPayments.cookPayoutAmount) })
        .from(orders)
        .innerJoin(orderPayments, fullPaymentJoin)
        .where(
          and(
            eq(orders.cookId, cookId),
            eq(orders.status, "fulfilled"),
            gte(orders.fulfilledAt, sql`date_trunc('week', now())`),
            lte(
              orders.fulfilledAt,
              sql`date_trunc('week', now()) + interval '7 days'`,
            ),
          ),
        ),

      // Net earnings this calendar month (fulfilled orders, by fulfillment time)
      db
        .select({ total: sum(orderPayments.cookPayoutAmount) })
        .from(orders)
        .innerJoin(orderPayments, fullPaymentJoin)
        .where(
          and(
            eq(orders.cookId, cookId),
            eq(orders.status, "fulfilled"),
            gte(orders.fulfilledAt, sql`date_trunc('month', now())`),
            lte(
              orders.fulfilledAt,
              sql`date_trunc('month', now()) + interval '1 month'`,
            ),
          ),
        ),

      // Net earnings all time (fulfilled orders)
      db
        .select({ total: sum(orderPayments.cookPayoutAmount) })
        .from(orders)
        .innerJoin(orderPayments, fullPaymentJoin)
        .where(and(eq(orders.cookId, cookId), eq(orders.status, "fulfilled"))),

      // Net earnings pending release (orders with status pending, confirmed, ready)
      db
        .select({ total: sum(orderPayments.cookPayoutAmount) })
        .from(orders)
        .innerJoin(orderPayments, fullPaymentJoin)
        .where(
          and(
            eq(orders.cookId, cookId),
            inArray(orders.status, ["pending", "confirmed", "ready"]),
          ),
        ),

      // Active meals count
      db
        .select({ count: count() })
        .from(dishes)
        .where(and(eq(dishes.cookId, cookId), eq(dishes.status, "active"))),

      // Rating stats
      db
        .select({
          average: sql<string>`AVG(${reviews.rating})`,
          count: count(),
        })
        .from(reviews)
        .where(eq(reviews.cookId, cookId)),
    ]);

    // Aggregate order counts by status
    const statusMap: Record<string, number> = {};
    for (const row of orderCounts) {
      statusMap[row.status] = Number(row.count);
    }

    // Fulfilled this month: reuse the monthly earnings query but we need count
    // We'll get fulfilledThisMonth and fulfilledAllTime from orderCounts grouping
    // Note: orderCounts only includes non-cancelled statuses; we need fulfilled separately
    const fulfilledAllTimeCount = await db
      .select({ count: count() })
      .from(orders)
      .where(and(eq(orders.cookId, cookId), eq(orders.status, "fulfilled")));

    const fulfilledThisMonthCount = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.cookId, cookId),
          eq(orders.status, "fulfilled"),
          gte(orders.fulfilledAt, sql`date_trunc('month', now())`),
          lte(
            orders.fulfilledAt,
            sql`date_trunc('month', now()) + interval '1 month'`,
          ),
        ),
      );

    const avgRating = ratingStats[0]?.average;

    return NextResponse.json({
      success: true,
      data: {
        orders: {
          pending: statusMap.pending ?? 0,
          confirmed: statusMap.confirmed ?? 0,
          ready: statusMap.ready ?? 0,
          fulfilledThisMonth: Number(fulfilledThisMonthCount[0]?.count ?? 0),
          fulfilledAllTime: Number(fulfilledAllTimeCount[0]?.count ?? 0),
        },
        earnings: {
          thisWeek: Number(earningsThisWeek[0]?.total ?? 0),
          thisMonth: Number(earningsThisMonth[0]?.total ?? 0),
          allTime: Number(earningsAllTime[0]?.total ?? 0),
          pending: Number(earningsPending[0]?.total ?? 0),
        },
        meals: {
          active: Number(activeMealsCount[0]?.count ?? 0),
        },
        // Legacy key — same value as meals.active
        listings: {
          active: Number(activeMealsCount[0]?.count ?? 0),
        },
        rating: {
          average: avgRating != null ? Number(avgRating) : null,
          count: Number(ratingStats[0]?.count ?? 0),
        },
      },
    });
  } catch (err) {
    console.error("[dashboard/stats]", err);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats." },
      { status: 500 },
    );
  }
}
