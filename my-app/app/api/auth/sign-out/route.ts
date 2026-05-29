import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  // Decide where to send the user BEFORE the session is invalidated, so the
  // sign-out lands them back on the right login page for their audience.
  let redirect = "/login";
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      const [account] = await db
        .select({ role: authUser.role })
        .from(authUser)
        .where(eq(authUser.id, session.user.id))
        .limit(1);
      if (account?.role === "cook" || account?.role === "admin") {
        redirect = "/business-auth/login";
      }
    }
  } catch {
    // No / unreadable session — fall back to the client login page.
  }

  const authRes = await auth.api.signOut({
    headers: req.headers,
    asResponse: true,
  });

  const res = NextResponse.json({ redirect });
  for (const cookie of (
    authRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}
