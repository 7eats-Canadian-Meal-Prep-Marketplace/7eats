import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitLog } from "@/db/schema";

const DEFAULT_WINDOW_MINUTES = Number(
  process.env.RATE_LIMIT_WINDOW_MINUTES ?? "60",
);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_MAX_ATTEMPTS ?? "3");

export async function logAndCheckRateLimit(
  key: string,
  opts?: { windowMinutes?: number; maxAttempts?: number },
): Promise<boolean> {
  const windowMinutes = opts?.windowMinutes ?? DEFAULT_WINDOW_MINUTES;
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  await db.insert(rateLimitLog).values({ ipHash: key });

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(rateLimitLog)
    .where(
      and(
        eq(rateLimitLog.ipHash, key),
        gt(rateLimitLog.attemptedAt, windowStart),
      ),
    );

  return result[0].count <= maxAttempts;
}
