import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema";

/**
 * Roles that own a phone number. A phone may be verified on at most one account
 * per role (see the `user_phone_role_verified_unique` partial index), so the
 * same number can back one cook and one client account simultaneously.
 */
export type PhoneOwnerRole = "client" | "cook" | "admin";

/**
 * Returns true when another account with the same role has already verified
 * this phone number. The current user is excluded so re-verifying your own
 * number never reports a conflict. Only verified phones count — unverified and
 * guest-checkout rows are ignored.
 */
export async function isPhoneTakenForRole(
  phone: string,
  role: PhoneOwnerRole,
  excludeUserId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(
      and(
        eq(authUser.phone, phone),
        eq(authUser.role, role),
        eq(authUser.phoneVerified, true),
        ne(authUser.id, excludeUserId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * User-facing message shown when a phone number is already verified on another
 * account of the same role.
 */
export function phoneTakenMessage(role: PhoneOwnerRole): string {
  return `This phone number is already in use by another ${role} account.`;
}

/**
 * Walks the error cause chain (Neon/Drizzle often nest Postgres errors) and
 * returns a SQLSTATE code when present.
 */
export function getPostgresErrorCode(err: unknown): string | null {
  let current: unknown = err;
  const seen = new Set<unknown>();

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
    current =
      "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }

  return null;
}

/**
 * Detects a Postgres unique-constraint violation (SQLSTATE 23505). Used as a
 * race-safe backstop: if two requests pass the pre-check concurrently, the
 * partial unique index rejects the second write and we surface the same
 * friendly error instead of a 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  return getPostgresErrorCode(err) === "23505";
}
