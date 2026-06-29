import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  deleteClientAccount,
  getClientDeleteEligibility,
  verifyClientPassword,
} from "@/lib/client/account-deletion";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function requireClientSession(
  session: Awaited<ReturnType<typeof auth.api.getSession>>,
) {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const authError = requireClientSession(session);
  if (authError) return authError;

  const [user] = await db
    .select({ status: authUser.status })
    .from(authUser)
    .where(eq(authUser.id, session!.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (user.status === "deleted") {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const eligibility = await getClientDeleteEligibility(session!.user.id);
  return NextResponse.json({ success: true, data: eligibility });
}

const deleteSchema = z.object({
  password: z.string().min(1).max(128),
});

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const authError = requireClientSession(session);
  if (authError) return authError;

  const userId = session!.user.id;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(
    `delete-account:${hashIp(ip)}:${userId}`,
    { windowMinutes: 60, maxAttempts: 5 },
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 },
    );
  }

  const validPassword = await verifyClientPassword(
    userId,
    parsed.data.password,
  );
  if (!validPassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  try {
    await deleteClientAccount(userId);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "ACTIVE_ORDERS") {
        const eligibility = await getClientDeleteEligibility(userId);
        return NextResponse.json(
          {
            error:
              "You have active orders. Finish or cancel them before deleting your account.",
            data: eligibility,
          },
          { status: 409 },
        );
      }
      if (err.message === "ALREADY_DELETED") {
        return NextResponse.json(
          { error: "Account not found." },
          { status: 404 },
        );
      }
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }
    }
    console.error("[user/account/DELETE]", err);
    return NextResponse.json(
      { error: "Could not delete account. Please try again." },
      { status: 500 },
    );
  }

  const authRes = await auth.api.signOut({
    headers: req.headers,
    asResponse: true,
  });

  const res = NextResponse.json({
    success: true,
    redirect: "/app-auth/login?deleted=1",
  });
  for (const cookie of (
    authRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }
  res.headers.append(
    "Set-Cookie",
    "7eats-onboarded=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  return res;
}
