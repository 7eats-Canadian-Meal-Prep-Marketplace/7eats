import { and, count, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookPayouts } from "@/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["pending", "in_transit", "paid", "failed", "cancelled"])
    .optional(),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query params." },
      { status: 400 },
    );
  }

  const { page, limit, status } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = status
    ? and(eq(cookPayouts.cookId, cookId), eq(cookPayouts.status, status))
    : eq(cookPayouts.cookId, cookId);

  try {
    const [totalResult, data] = await Promise.all([
      db.select({ total: count() }).from(cookPayouts).where(conditions),

      db
        .select()
        .from(cookPayouts)
        .where(conditions)
        .orderBy(desc(cookPayouts.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: Number(totalResult[0]?.total ?? 0),
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("[dashboard/payouts]", err);
    return NextResponse.json(
      { error: "Failed to fetch payouts." },
      { status: 500 },
    );
  }
}
