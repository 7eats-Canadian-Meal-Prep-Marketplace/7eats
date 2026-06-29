import { type NextRequest, NextResponse } from "next/server";
import { cancelStaleAbandonedCheckouts } from "@/lib/orders/abandoned-checkout";

/**
 * Manual trigger for unpaid checkout cleanup. Scheduled runs use
 * `/api/cron/reconcile` (Vercel Hobby allows one daily cron only).
 * Protect with CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await cancelStaleAbandonedCheckouts();
    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("[cron/abandoned-checkouts]", err);
    return NextResponse.json(
      { error: "Abandoned checkout cleanup failed." },
      { status: 500 },
    );
  }
}
