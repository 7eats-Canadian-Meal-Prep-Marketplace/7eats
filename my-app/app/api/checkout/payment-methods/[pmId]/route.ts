import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { detachCustomerPaymentMethod } from "@/lib/payment-methods";

export type Params = { params: Promise<{ pmId: string }> };

const pmIdSchema = z.string().regex(/^pm_/);

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "client") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { pmId } = await params;
  if (!pmIdSchema.safeParse(pmId).success) {
    return NextResponse.json(
      { error: "Invalid payment method." },
      { status: 400 },
    );
  }

  const [user] = await db
    .select({ stripeCustomerId: authUser.stripeCustomerId })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Payment method not found." },
      { status: 404 },
    );
  }

  try {
    await detachCustomerPaymentMethod(user.stripeCustomerId as string, pmId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    console.error("[checkout/payment-methods/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to remove card." },
      { status: 500 },
    );
  }
}
