import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { reviews } from "@/db/schema";

export type Params = { params: Promise<{ reviewId: string }> };

const bodySchema = z.object({
  response: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { reviewId } = await params;

  const idParsed = z.string().uuid().safeParse(reviewId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const [existing] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.cookId, cookId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const now = new Date();

    await db
      .update(reviews)
      .set({ cookResponse: body.response, cookResponseAt: now })
      .where(eq(reviews.id, reviewId));

    return NextResponse.json({
      success: true,
      data: { id: reviewId, cookResponse: body.response, cookResponseAt: now },
    });
  } catch (err) {
    console.error("[dashboard/reviews/[reviewId]/response]", err);
    return NextResponse.json(
      { error: "Failed to save response." },
      { status: 500 },
    );
  }
}
