import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orders, reviews } from "@/db/schema";
import { auth } from "@/lib/auth";

export type Params = { params: Promise<{ orderId: string }> };

const orderIdSchema = z.string().uuid();

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
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

  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { rating, comment } = parsed.data;

  try {
    const [order] = await db
      .select({
        id: orders.id,
        clientId: orders.clientId,
        cookId: orders.cookId,
        status: orders.status,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.clientId, session.user.id)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "fulfilled") {
      return NextResponse.json(
        { error: "Order must be fulfilled before leaving a review." },
        { status: 400 },
      );
    }

    const [existingReview] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);

    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this order." },
        { status: 409 },
      );
    }

    const [review] = await db
      .insert(reviews)
      .values({
        orderId,
        clientId: session.user.id,
        cookId: order.cookId,
        rating,
        comment: comment ?? null,
      })
      .returning();

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (err) {
    console.error("[orders/[orderId]/reviews/POST]", err);
    return NextResponse.json(
      { error: "Failed to create review." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
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

  const parsed = updateReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields provided to update." },
      { status: 400 },
    );
  }

  try {
    const [review] = await db
      .select({
        id: reviews.id,
        clientId: reviews.clientId,
      })
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);

    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    if (review.clientId !== session.user.id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const [updated] = await db
      .update(reviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reviews.id, review.id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[orders/[orderId]/reviews/PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update review." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const [review] = await db
      .select({
        id: reviews.id,
        clientId: reviews.clientId,
      })
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);

    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    if (review.clientId !== session.user.id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    await db.delete(reviews).where(eq(reviews.id, review.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[orders/[orderId]/reviews/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to delete review." },
      { status: 500 },
    );
  }
}
