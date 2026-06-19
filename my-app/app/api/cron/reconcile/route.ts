import { and, eq, lt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orderPayments, orders } from "@/db/schema";
import { sendMail } from "@/lib/email";

/**
 * Payment reconciliation job (run on a schedule, e.g. Vercel Cron).
 *
 * Flags `authorized` payments that have sat for more than 48 hours — these are
 * stuck holds (order never confirmed/captured or abandoned mid-checkout) that
 * should be reviewed and either captured or cancelled before the Stripe
 * authorization expires. Emails a summary to the team when any are found.
 *
 * Protect with a CRON_SECRET so only the scheduler can trigger it.
 */
const STALE_HOURS = 48;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - STALE_HOURS * 3600_000);

    const stuck = await db
      .select({
        paymentId: orderPayments.id,
        orderId: orderPayments.orderId,
        amount: orderPayments.totalAmount,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        authorizedAt: orderPayments.authorizedAt,
        orderStatus: orders.status,
      })
      .from(orderPayments)
      .innerJoin(orders, eq(orderPayments.orderId, orders.id))
      .where(
        and(
          eq(orderPayments.status, "authorized"),
          lt(orderPayments.authorizedAt, cutoff),
        ),
      );

    if (stuck.length > 0) {
      const lines = stuck
        .map(
          (s) =>
            `- order ${s.orderId} (${s.orderStatus}) · $${s.amount} · PI ${s.stripePaymentIntentId} · authorized ${s.authorizedAt?.toISOString()}`,
        )
        .join("\n");
      const team = process.env.RESEND_TEAM_EMAIL;
      if (team) {
        await sendMail({
          to: team,
          subject: `[7eats] ${stuck.length} stuck authorized payment(s)`,
          text: [
            `${stuck.length} payment(s) have been authorized for more than ${STALE_HOURS}h without release or refund.`,
            "Review and capture or cancel them before the Stripe authorization expires.",
            "",
            lines,
          ].join("\n"),
        });
      }
    }

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      stuckCount: stuck.length,
      stuck,
    });
  } catch (err) {
    console.error("[cron/reconcile]", err);
    return NextResponse.json(
      { error: "Reconciliation failed." },
      { status: 500 },
    );
  }
}
