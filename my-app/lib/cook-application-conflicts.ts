import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { authUser, cookApplications } from "@/db/schema";

export type CookApplicationConflict =
  | { kind: "application_filed" }
  | { kind: "cook_account" }
  | { kind: "client_account" };

const CONFLICT_MESSAGES: Record<CookApplicationConflict["kind"], string> = {
  application_filed:
    "You've already filed an application with this email. Our team will reach out within 2 business days. Contact us if you need to update your details.",
  cook_account:
    "This email is already linked to a cook account. Sign in to manage your kitchen, or contact us if you need help.",
  client_account:
    "This email is already in use for a customer account. Use a different contact email for your cook application, or contact us for help.",
};

export function cookApplicationConflictMessage(
  conflict: CookApplicationConflict,
): string {
  return CONFLICT_MESSAGES[conflict.kind];
}

/** Returns a conflict when the contact or business email is already in use. */
export async function findCookApplicationConflict(
  contactEmail: string,
  businessEmail: string,
): Promise<CookApplicationConflict | null> {
  const [existingApplication] = await db
    .select({ id: cookApplications.id })
    .from(cookApplications)
    .where(eq(cookApplications.contactEmail, contactEmail))
    .limit(1);

  if (existingApplication) {
    return { kind: "application_filed" };
  }

  const emails = [...new Set([contactEmail, businessEmail])];
  const [existingUser] = await db
    .select({ role: authUser.role })
    .from(authUser)
    .where(
      emails.length === 1
        ? eq(authUser.email, emails[0]!)
        : or(eq(authUser.email, emails[0]!), eq(authUser.email, emails[1]!)),
    )
    .limit(1);

  if (!existingUser) return null;

  if (existingUser.role === "cook") {
    return { kind: "cook_account" };
  }

  if (existingUser.role === "client") {
    return { kind: "client_account" };
  }

  return null;
}
