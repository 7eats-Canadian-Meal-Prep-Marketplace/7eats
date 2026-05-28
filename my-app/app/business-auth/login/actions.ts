"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { forwardAuthCookies } from "@/lib/auth-cookies";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

export async function login(data: {
  email: string;
  password: string;
}): Promise<{ error?: string }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";

  const allowed = await logAndCheckRateLimit(`login:${ip}`, {
    windowMinutes: 15,
    maxAttempts: 5,
  });
  if (!allowed) {
    return { error: "Too many login attempts. Try again in 15 minutes." };
  }

  const response = await auth.api.signInEmail({
    body: {
      email: data.email.toLowerCase().trim(),
      password: data.password,
    },
    headers: h,
    asResponse: true,
  });

  if (!response.ok) {
    return { error: "Incorrect email or password." };
  }

  await forwardAuthCookies(response);
  redirect("/business/dashboard");
}

export async function logout(): Promise<void> {
  const h = await headers();
  const response = await auth.api.signOut({
    headers: h,
    asResponse: true,
  });
  await forwardAuthCookies(response);
  redirect("/business-auth/login");
}
