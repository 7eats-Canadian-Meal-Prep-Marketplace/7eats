import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { confirmClientOrderPayment } from "@/lib/orders/confirm-order-payment";

export type Params = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  guestAccessToken: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok for logged-in clients */
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session && !parsed.data.guestAccessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const result = await confirmClientOrderPayment(
      orderId,
      session?.user.id ?? null,
      parsed.data.guestAccessToken,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyAuthorized: result.alreadyAuthorized ?? false,
    });
  } catch (err) {
    console.error("[orders/confirm-payment]", err);
    return NextResponse.json(
      { error: "Could not confirm payment." },
      { status: 500 },
    );
  }
}
