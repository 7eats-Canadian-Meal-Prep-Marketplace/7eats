import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
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

  if (application.status === "approved") {
    return NextResponse.json(
      { error: "Application is already approved." },
      { status: 409 },
    );
  }

  if (application.status !== "pending_review") {
    return NextResponse.json(
      { error: "Application is not in pending_review status." },
      { status: 409 },
    );
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  await dbPool.transaction(async (tx) => {
    await tx
      .insert(setupTokens)
      .values({ applicationId, tokenHash, expiresAt });
    await tx
      .update(cookApplications)
      .set({ status: "approved" })
      .where(eq(cookApplications.id, applicationId));
  });

  try {
    await sendSetupEmail(
      application.contactEmail,
      application.kitchenName,
      rawToken,
    );
  } catch (err) {
    console.error("[issue-link] Resend failed:", err);
    await dbPool.transaction(async (tx) => {
      await tx.delete(setupTokens).where(eq(setupTokens.tokenHash, tokenHash));
      await tx
        .update(cookApplications)
        .set({ status: "pending_review" })
        .where(eq(cookApplications.id, applicationId));
    });
    return NextResponse.json(
      {
        error:
          "Email delivery failed. Application reverted to pending_review. Retry when ready.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
