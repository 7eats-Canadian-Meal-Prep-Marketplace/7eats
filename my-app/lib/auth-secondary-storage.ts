import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { authKvStore } from "@/db/schema";

// Postgres-backed implementation of Better Auth's `SecondaryStorage`
// interface (see lib/auth.ts). Better Auth's built-in rate limiter falls
// back to an in-process in-memory Map when no secondaryStorage is
// configured, which does not work across the independent serverless
// function instances Vercel routes concurrent requests to. Backing it with
// Neon gives every instance a shared, durable counter.
export const authSecondaryStorage = {
  async get(key: string): Promise<string | null> {
    const [row] = await db
      .select({ value: authKvStore.value })
      .from(authKvStore)
      .where(
        and(
          eq(authKvStore.key, key),
          or(
            isNull(authKvStore.expiresAt),
            gt(authKvStore.expiresAt, sql`now()`),
          ),
        ),
      )
      .limit(1);

    return row?.value ?? null;
  },

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;

    await db
      .insert(authKvStore)
      .values({ key, value, expiresAt })
      .onConflictDoUpdate({
        target: authKvStore.key,
        set: { value, expiresAt },
      });
  },

  async delete(key: string): Promise<void> {
    await db.delete(authKvStore).where(eq(authKvStore.key, key));
  },
};
