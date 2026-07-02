import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, dbPool } from "@/db";
import { cookApplications, setupTokens } from "@/db/schema";
import { hashToken, sendSetupEmail, verifyInternalRequest } from "../_lib";

export async function POST(req: Request) {
  if (!verifyInternalRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let applicationId: string;
  try {
    const body = await req.json();
    if (!body?.applicationId || typeof body.applicationId !== "string") {
      return NextResponse.json(
        { error: "applicationId is required" },
        { status: 400 },
      );
    }
    applicationId = body.applicationId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const [application] = await db
    .select()
    .from(cookApplications)
    .where(eq(cookApplications.id, applicationId))
    .limit(1);

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 },
    );
  }

  if (application.status !== "approved") {
    return NextResponse.json(
      { error: "Application must be approved before re-issuing a link." },
      { status: 409 },
    );
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  await dbPool.transaction(async (tx) => {
    await tx
      .update(setupTokens)
      .set({ expiresAt: new Date() })
      .where(
        and(
          eq(setupTokens.applicationId, applicationId),
          isNull(setupTokens.consumedAt),
        ),
      );
    await tx
      .insert(setupTokens)
      .values({ applicationId, tokenHash, expiresAt });
  });

  try {
    await sendSetupEmail(
      application.contactEmail,
      application.kitchenName,
      rawToken,
    );
  } catch (err) {
    console.error("[reissue-link] Resend failed:", err);
    await db.delete(setupTokens).where(eq(setupTokens.tokenHash, tokenHash));
    return NextResponse.json(
      { error: "Email delivery failed. New token deleted. Retry when ready." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
