import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(`login:${ip}`, {
    windowMinutes: 15,
    maxAttempts: 5,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const authRes = await auth.api.signInEmail({
    body: { email: (email as string).toLowerCase().trim(), password },
    headers: req.headers,
    asResponse: true,
  });

  if (!authRes.ok) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ redirect: "/business/dashboard" });
  for (const cookie of (
    authRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}
