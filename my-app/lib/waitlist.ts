import { db } from "@/db";
import { waitlist } from "@/db/schema";

export async function addToWaitlist(
  email: string,
  ipHash: string,
  city?: string | null,
): Promise<boolean> {
  const trimmedCity = city?.trim();
  const inserted = await db
    .insert(waitlist)
    .values({ email, ipHash, ...(trimmedCity ? { city: trimmedCity } : {}) })
    .onConflictDoNothing({ target: waitlist.email })
    .returning();

  return inserted.length > 0;
}
