import { db } from "@/db";
import { waitlist } from "@/db/schema";

export async function addToWaitlist(email: string, ipHash: string): Promise<void> {
  await db
    .insert(waitlist)
    .values({ email, ipHash })
    .onConflictDoNothing({ target: waitlist.email });
}
