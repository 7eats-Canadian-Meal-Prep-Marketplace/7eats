import { and, eq, gte, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { orders } from "@/db/schema";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const querySchema = z.object({
  period: z.enum(["week", "month"]).default("week"),
  count: z.coerce.number().int().min(1).max(52).optional(),
});

/** Returns the Monday (UTC) of the ISO week containing `date`. */
function currentMondayUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Format a Date as "Mon DD" (e.g. "Mar 17") using UTC values. */
function formatDayLabel(date: Date): string {
  const month = MONTH_LABELS[date.getUTCMonth()];
  const day = date.getUTCDate();
  return `${month} ${day}`;
}

interface PeriodBucket {
  label: string;
  start: Date;
  end: Date;
}

function buildWeeklyPeriods(count: number): PeriodBucket[] {
  const latestMonday = currentMondayUTC();
  return Array.from({ length: count }, (_, i) => {
    // i=0 → oldest period, i=count-1 → most recent
    const weekStart = new Date(latestMonday);
    weekStart.setUTCDate(latestMonday.getUTCDate() - (count - 1 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
    return {
      label: formatDayLabel(weekStart),
      start: weekStart,
      end: weekEnd,
    };
  });
}

function buildMonthlyPeriods(count: number): PeriodBucket[] {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-based

  return Array.from({ length: count }, (_, i) => {
    // i=0 → oldest, i=count-1 → current month
    const offsetMonths = count - 1 - i;
    let year = currentYear;
    let month = currentMonth - offsetMonths; // 0-based

    // Normalize negative months
    while (month < 0) {
      month += 12;
      year -= 1;
    }

    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    return {
      label: MONTH_LABELS[month] ?? String(month + 1),
      start,
      end,
    };
  });
}

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    count: searchParams.get("count") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query params." },
      { status: 400 },
    );
  }

  const { period } = parsed.data;
  const defaultCount = period === "week" ? 8 : 12;
  const count = parsed.data.count ?? defaultCount;

  const periods =
    period === "week" ? buildWeeklyPeriods(count) : buildMonthlyPeriods(count);

  // Earliest start and latest end for a single DB query
  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];
  if (!firstPeriod || !lastPeriod) {
    return NextResponse.json({ success: true, data: { series: [], total: 0 } });
  }
  const rangeStart = firstPeriod.start;
  const rangeEnd = lastPeriod.end;

  try {
    const rawOrders = await db
      .select({
        // Earnings are bucketed by when the order was actually completed
        // (`fulfilledAt`), not the scheduled pickup time. `pickupAt` is null for
        // pickup orders (the server owns timing), so filtering by it returned
        // nothing and the chart always showed $0.
        fulfilledAt: orders.fulfilledAt,
        totalPrice: orders.totalPrice,
      })
      .from(orders)
      .where(
        and(
          eq(orders.cookId, cookId),
          eq(orders.status, "fulfilled"),
          gte(orders.fulfilledAt, rangeStart),
          lte(orders.fulfilledAt, rangeEnd),
        ),
      );

    // Aggregate into period buckets in TypeScript
    const bucketTotals = new Map<string, number>(
      periods.map((p) => [p.label, 0]),
    );

    for (const row of rawOrders) {
      if (!row.fulfilledAt) continue;
      const fulfilledTime = row.fulfilledAt.getTime();
      for (const bucket of periods) {
        if (
          fulfilledTime >= bucket.start.getTime() &&
          fulfilledTime < bucket.end.getTime()
        ) {
          bucketTotals.set(
            bucket.label,
            (bucketTotals.get(bucket.label) ?? 0) + Number(row.totalPrice),
          );
          break;
        }
      }
    }

    const series = periods.map((p) => ({
      label: p.label,
      value: bucketTotals.get(p.label) ?? 0,
    }));

    const total = series.reduce((sum, point) => sum + point.value, 0);

    return NextResponse.json({
      success: true,
      data: {
        series,
        total,
      },
    });
  } catch (err) {
    console.error("[dashboard/earnings/history]", err);
    return NextResponse.json(
      { error: "Failed to fetch earnings history." },
      { status: 500 },
    );
  }
}
