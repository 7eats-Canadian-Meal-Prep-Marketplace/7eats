import { and, eq, gt, sql } from "drizzle-orm";
import { dbPool } from "@/db";
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

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  return dbPool.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`rate-limit:${key}`}))`,
    );

    const result = await tx
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(rateLimitLog)
      .where(
        and(
          eq(rateLimitLog.ipHash, key),
          gt(rateLimitLog.attemptedAt, windowStart),
        ),
      );

    if (result[0].count >= maxAttempts) {
      return false;
    }

    await tx.insert(rateLimitLog).values({ ipHash: key });
    return true;
  });
}
