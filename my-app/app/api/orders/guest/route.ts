import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ensureStripeCustomer, resolveGuestClient } from "@/lib/guest-client";
import {
  GUEST_EMAIL_VERIFIED_COOKIE,
  isEmailVerified,
} from "@/lib/guest-email-otp";
import {
  generateConfirmationCode,
  generateGuestAccessToken,
  hashGuestAccessToken,
} from "@/lib/guest-order-access";
import { hashIp } from "@/lib/hash";
import { getGuestOrderByToken } from "@/lib/orders/guest-order-lookup";
import {
  createOrderBodySchema,
  placeClientOrder,
} from "@/lib/orders/place-order";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const guestOrderSchema = createOrderBodySchema.extend({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(20),
  acceptedTerms: z.literal(true),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function uniqueConfirmationCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateConfirmationCode();
    const [existing] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.confirmationCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("CONFIRMATION_CODE_EXHAUSTED");
}

/** GET /api/orders/guest?token= — load guest receipt (no session). */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const ip = clientIp(req);
  const allowed = await logAndCheckRateLimit(`guest-order-view:${hashIp(ip)}`, {
    windowMinutes: 15,
    maxAttempts: 60,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const order = await getGuestOrderByToken(token);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: order });
}

/** POST /api/orders/guest — place order without session. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const allowed = await logAndCheckRateLimit(`guest-order:${hashIp(ip)}`, {
    windowMinutes: 60,
    maxAttempts: 8,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many guest orders. Please try again later." },
      { status: 429 },
    );
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

  const parsed = guestOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    acceptedTerms: _,
    ...orderBody
  } = parsed.data;

  // Email-verification gate: a guest must have proven they can read mail at this
  // address (via the email OTP flow) before we create an account and order for
  // it. Without this, a mistyped email silently loses the order and its receipt.
  const verifiedCookie = req.cookies.get(GUEST_EMAIL_VERIFIED_COOKIE)?.value;
  if (!isEmailVerified(verifiedCookie, email)) {
    return NextResponse.json(
      {
        error: "Please verify your email before placing your order.",
        needsEmailVerification: true,
      },
      { status: 403 },
    );
  }

  try {
    const guest = await resolveGuestClient({
      firstName,
      lastName,
      email,
      phone,
      headers: req.headers,
      ip,
    });

    if ("needsLogin" in guest) {
      return NextResponse.json({ needsLogin: true, email: guest.email });
    }

    const displayName = `${firstName} ${lastName}`.trim();
    const stripeCustomerId = await ensureStripeCustomer(
      guest.clientId,
      guest.email,
      displayName,
    );

    const accessToken = generateGuestAccessToken();
    const confirmationCode = await uniqueConfirmationCode();

    const result = await placeClientOrder(
      {
        id: guest.clientId,
        email: guest.email,
        firstName: guest.firstName,
        lastName: guest.lastName,
        displayName,
        stripeCustomerId,
      },
      orderBody,
      {
        confirmationCode,
        guestAccessTokenHash: hashGuestAccessToken(accessToken),
        accessToken,
      },
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          unavailableDishes: result.unavailableDishes,
          dishId: result.dishId,
        },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: result.orderId,
          clientSecret: result.clientSecret,
          confirmationCode,
          accessToken,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if ((err as Error).message === "GUEST_SIGNUP_FAILED") {
      return NextResponse.json(
        { error: "Could not process guest checkout. Please try again." },
        { status: 500 },
      );
    }
    console.error("[orders/guest/POST]", err);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 },
    );
  }
}
