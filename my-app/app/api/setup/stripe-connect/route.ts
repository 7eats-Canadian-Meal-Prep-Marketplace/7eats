import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await db
    .update(cookProfiles)
    .set({ stripeAccountId: `mock_acct_${session.user.id.slice(0, 8)}` })
    .where(eq(cookProfiles.userId, session.user.id));

  return NextResponse.json({ success: true });
}
