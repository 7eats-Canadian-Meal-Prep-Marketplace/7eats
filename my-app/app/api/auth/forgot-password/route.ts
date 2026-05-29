import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = await req.json();
  const email =
    typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(`forgot-password:${hashIp(ip)}`, {
    windowMinutes: 15,
    maxAttempts: 5,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/business-auth/reset-password`;

  // Errors swallowed intentionally — always return 200 to prevent email enumeration.
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo } });
  } catch (e) {
    console.error("[forgot-password]", e);
  }

  return NextResponse.json({ success: true });
}
