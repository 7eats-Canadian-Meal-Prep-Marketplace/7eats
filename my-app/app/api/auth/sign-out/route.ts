import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const authRes = await auth.api.signOut({
    headers: req.headers,
    asResponse: true,
  });

  const res = NextResponse.json({ redirect: "/business-auth/login" });
  for (const cookie of (
    authRes.headers as Headers & { getSetCookie?(): string[] }
  ).getSetCookie?.() ?? []) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}
