import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashIp } from "@/lib/hash";
import { cancelGuestOrderByToken } from "@/lib/orders/cancel-order";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(16),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** POST /api/orders/guest/cancel — cancel via e-mail link token. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const allowed = await logAndCheckRateLimit(
    `guest-order-cancel:${hashIp(ip)}`,
    {
      windowMinutes: 15,
      maxAttempts: 20,
    },
  );
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  try {
    const result = await cancelGuestOrderByToken(parsed.data.token);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      success: true,
      data: { orderId: result.orderId, refunded: result.refunded },
    });
  } catch (err) {
    console.error("[orders/guest/cancel/POST]", err);
    return NextResponse.json(
      { error: "Could not cancel order." },
      { status: 500 },
    );
  }
}
