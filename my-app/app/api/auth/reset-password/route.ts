import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const { token, newPassword } = body ?? {};

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const res = await auth.api.resetPassword({
    body: { newPassword, token },
    asResponse: true,
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          "This reset link has expired or is no longer valid. Request a new one.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ redirect: "/business-auth/login" });
}
