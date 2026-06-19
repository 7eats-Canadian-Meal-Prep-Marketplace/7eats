import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = await req.json();
  const { token, newPassword } = body ?? {};

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pwError = validatePassword(newPassword);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const res = await auth.api.resetPassword({
    body: { newPassword, token },
    asResponse: true,
  });

  const audience = body?.audience === "client" ? "client" : "business";

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          "This reset link has expired or is no longer valid. Request a new one.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    redirect:
      audience === "client" ? "/app-auth/login" : "/business-auth/login",
  });
}
