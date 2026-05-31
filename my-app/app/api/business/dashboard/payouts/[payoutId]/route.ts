import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookPayouts } from "@/db/schema";

export type Params = { params: Promise<{ payoutId: string }> };

const payoutIdSchema = z.string().uuid();

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { payoutId } = await params;

  const parsed = payoutIdSchema.safeParse(payoutId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payout ID." }, { status: 400 });
  }

  try {
    const [payout] = await db
      .select()
      .from(cookPayouts)
      .where(and(eq(cookPayouts.id, payoutId), eq(cookPayouts.cookId, cookId)))
      .limit(1);

    if (!payout) {
      return NextResponse.json({ error: "Payout not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: payout });
  } catch (err) {
    console.error("[dashboard/payouts/[payoutId]]", err);
    return NextResponse.json(
      { error: "Failed to fetch payout." },
      { status: 500 },
    );
  }
}
