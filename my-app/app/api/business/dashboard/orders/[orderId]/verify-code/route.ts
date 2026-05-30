import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { orders } from "@/db/schema";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.uuid();

const bodySchema = z.object({
  code: z.string().min(1).max(20),
});

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { orderId } = await params;

  const orderIdParsed = orderIdSchema.safeParse(orderId);
  if (!orderIdParsed.success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { code } = parsed.data;

  try {
    const [order] = await db
      .select({
        id: orders.id,
        cookId: orders.cookId,
        status: orders.status,
        pickupCodeHash: orders.pickupCodeHash,
        pickupCodeExpiresAt: orders.pickupCodeExpiresAt,
        pickupCodeAttempts: orders.pickupCodeAttempts,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "ready") {
      return NextResponse.json(
        { error: "Order is not ready for pickup." },
        { status: 400 },
      );
    }

    if (order.pickupCodeAttempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Contact support." },
        { status: 429 },
      );
    }

    if (!order.pickupCodeExpiresAt || order.pickupCodeExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Pickup code has expired." },
        { status: 400 },
      );
    }

    const codeHash = createHash("sha256").update(code.trim()).digest("hex");

    if (codeHash !== order.pickupCodeHash) {
      const [updated] = await db
        .update(orders)
        .set({ pickupCodeAttempts: sql`${orders.pickupCodeAttempts} + 1` })
        .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
        .returning({ pickupCodeAttempts: orders.pickupCodeAttempts });

      const newAttempts =
        updated?.pickupCodeAttempts ?? order.pickupCodeAttempts + 1;
      return NextResponse.json(
        {
          error: "Invalid code.",
          attemptsRemaining: MAX_ATTEMPTS - newAttempts,
        },
        { status: 400 },
      );
    }

    const fulfilledAt = new Date();
    const [fulfilled] = await db
      .update(orders)
      .set({
        status: "fulfilled",
        pickupCodeVerifiedAt: fulfilledAt,
        fulfilledAt,
      })
      .where(and(eq(orders.id, orderId), eq(orders.cookId, cookId)))
      .returning({ id: orders.id, fulfilledAt: orders.fulfilledAt });

    return NextResponse.json({
      success: true,
      data: { orderId: fulfilled?.id, fulfilledAt: fulfilled?.fulfilledAt },
    });
  } catch (err) {
    console.error("[dashboard/orders/verify-code]", err);
    return NextResponse.json(
      { error: "Failed to verify pickup code." },
      { status: 500 },
    );
  }
}
