"use server";

import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  cookApplications,
  cookProfiles,
  setupTokens,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { forwardAuthCookies } from "@/lib/auth-cookies";

export async function createAccount(
  token: string,
  password: string,
): Promise<{ error: string } | undefined> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [tokenRow] = await db
    .select()
    .from(setupTokens)
    .where(
      and(
        eq(setupTokens.tokenHash, tokenHash),
        isNull(setupTokens.consumedAt),
        gt(setupTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    return {
      error: "This link has expired. Please contact us for a new one.",
    };
  }

  const [application] = await db
    .select()
    .from(cookApplications)
    .where(eq(cookApplications.id, tokenRow.applicationId))
    .limit(1);

  if (!application) {
    return { error: "Application not found." };
  }

  const fullName = `${application.contactFirstName} ${application.contactLastName}`;

  // Pass request headers so Better Auth can record IP + user agent
  const reqHeaders = await headers();
  const signUpRes = await auth.api.signUpEmail({
    body: {
      email: application.contactEmail,
      password,
      name: fullName,
    },
    headers: reqHeaders,
    asResponse: true,
  });

  if (!signUpRes.ok) {
    // 422 = unprocessable (e.g. email already registered in Better Auth)
    // Token is still unconsumed — cook can retry after contacting support
    console.error(
      "[createAccount] Better Auth signup failed:",
      signUpRes.status,
    );
    return {
      error: "Could not create account. Please contact us if this persists.",
    };
  }

  const payload = (await signUpRes.json()) as {
    user?: { id: string };
  };
  const betterAuthUserId = payload?.user?.id;

  if (!betterAuthUserId) {
    return { error: "Something went wrong. Please try again." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: betterAuthUserId,
        role: "cook",
        status: "active",
        firstName: application.contactFirstName,
        lastName: application.contactLastName,
        email: application.contactEmail,
        phoneVerified: false,
      });

      await tx.insert(cookProfiles).values({
        userId: betterAuthUserId,
        applicationId: application.id,
        displayName: application.kitchenName,
      });

      await tx
        .update(setupTokens)
        .set({ consumedAt: new Date() })
        .where(eq(setupTokens.id, tokenRow.id));
    });
  } catch (err) {
    console.error("[createAccount] DB transaction failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  // Forward Better Auth session cookies to the browser
  await forwardAuthCookies(signUpRes);

  redirect("/business-auth/setup/verify-phone");
}
