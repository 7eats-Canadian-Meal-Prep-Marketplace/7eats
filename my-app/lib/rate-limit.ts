import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitLog } from "@/db/schema";

const WINDOW_MINUTES = Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? "60");
const MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_MAX_ATTEMPTS ?? "3");

export async function logAndCheckRateLimit(ipHash: string): Promise<boolean> {
  await db.insert(rateLimitLog).values({ ipHash });

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(rateLimitLog)
    .where(
      and(
        eq(rateLimitLog.ipHash, ipHash),
        gt(rateLimitLog.attemptedAt, windowStart)
      )
    );

  return result[0].count <= MAX_ATTEMPTS;
}
