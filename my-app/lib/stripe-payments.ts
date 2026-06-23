import { getStripe } from "@/lib/stripe";

const PLATFORM_CURRENCY = "cad" as const;

export interface PaymentIntentResult {
  piId: string;
  status: string;
  clientSecret: string | null;
}

export async function createCheckoutPaymentIntent(params: {
  totalAmountCents: number;
  /** Platform commission + tax remittance (destination charge split). */
  applicationFeeCents: number;
  stripeCustomerId: string;
  connectedAccountId: string;
  idempotencyKey: string;
  orderId: string;
}): Promise<PaymentIntentResult> {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.create(
    {
      amount: params.totalAmountCents,
      currency: PLATFORM_CURRENCY,
      customer: params.stripeCustomerId,
      capture_method: "manual",
      setup_future_usage: "off_session",
      payment_method_types: ["card"],
      transfer_data: { destination: params.connectedAccountId },
      application_fee_amount: params.applicationFeeCents,
      metadata: { orderId: params.orderId },
    },
    { idempotencyKey: params.idempotencyKey },
  );
  return { piId: pi.id, status: pi.status, clientSecret: pi.client_secret };
}

/** @deprecated Use createCheckoutPaymentIntent + client-side confirmPayment. */
export async function createFullPaymentIntent(params: {
  totalAmountCents: number;
  /** Platform commission + tax remittance (destination charge split). */
  applicationFeeCents: number;
  stripeCustomerId: string;
  paymentMethodId: string;
  connectedAccountId: string;
  idempotencyKey: string;
}): Promise<PaymentIntentResult> {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.create(
    {
      amount: params.totalAmountCents,
      currency: PLATFORM_CURRENCY,
      customer: params.stripeCustomerId,
      payment_method: params.paymentMethodId,
      capture_method: "manual",
      confirm: true,
      transfer_data: { destination: params.connectedAccountId },
      application_fee_amount: params.applicationFeeCents,
    },
    { idempotencyKey: params.idempotencyKey },
  );
  return { piId: pi.id, status: pi.status, clientSecret: pi.client_secret };
}

export async function createSplitPaymentIntents(params: {
  depositAmountCents: number;
  balanceAmountCents: number;
  depositPlatformFeeCents: number;
  balancePlatformFeeCents: number;
  stripeCustomerId: string;
  paymentMethodId: string;
  connectedAccountId: string;
  orderId: string;
}): Promise<{ deposit: PaymentIntentResult; balance: PaymentIntentResult }> {
  const stripe = getStripe();
  const [depositPi, balancePi] = await Promise.all([
    stripe.paymentIntents.create(
      {
        amount: params.depositAmountCents,
        currency: PLATFORM_CURRENCY,
        customer: params.stripeCustomerId,
        payment_method: params.paymentMethodId,
        capture_method: "manual",
        confirm: true,
        transfer_data: { destination: params.connectedAccountId },
        application_fee_amount: params.depositPlatformFeeCents,
      },
      { idempotencyKey: `deposit-${params.orderId}` },
    ),
    stripe.paymentIntents.create(
      {
        amount: params.balanceAmountCents,
        currency: PLATFORM_CURRENCY,
        customer: params.stripeCustomerId,
        payment_method: params.paymentMethodId,
        capture_method: "manual",
        confirm: true,
        transfer_data: { destination: params.connectedAccountId },
        application_fee_amount: params.balancePlatformFeeCents,
      },
      { idempotencyKey: `balance-${params.orderId}` },
    ),
  ]);
  return {
    deposit: {
      piId: depositPi.id,
      status: depositPi.status,
      clientSecret: depositPi.client_secret,
    },
    balance: {
      piId: balancePi.id,
      status: balancePi.status,
      clientSecret: balancePi.client_secret,
    },
  };
}

export async function capturePaymentIntent(
  piId: string,
  idempotencyKey: string,
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.capture(piId, {}, { idempotencyKey });
}

export async function partialCapturePaymentIntent(params: {
  piId: string;
  captureAmountCents: number;
  newPlatformFeeCents: number;
  idempotencyKey: string;
}): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.update(params.piId, {
    application_fee_amount: params.newPlatformFeeCents,
  });
  await stripe.paymentIntents.capture(
    params.piId,
    { amount_to_capture: params.captureAmountCents },
    { idempotencyKey: params.idempotencyKey },
  );
}

export async function cancelPaymentIntent(
  piId: string,
  idempotencyKey: string,
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.cancel(piId, {}, { idempotencyKey });
}

export async function refundPaymentIntent(params: {
  paymentIntentId: string;
  amountCents?: number;
  reverseTransfer?: boolean;
  idempotencyKey: string;
}): Promise<string> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create(
    {
      payment_intent: params.paymentIntentId,
      ...(params.amountCents !== undefined
        ? { amount: params.amountCents }
        : {}),
      reverse_transfer: params.reverseTransfer ?? false,
    },
    { idempotencyKey: params.idempotencyKey },
  );
  return refund.id;
}

export async function createSubscriptionTransfer(params: {
  amountCents: number;
  connectedAccountId: string;
  idempotencyKey: string;
}): Promise<string> {
  const stripe = getStripe();
  const transfer = await stripe.transfers.create(
    {
      amount: params.amountCents,
      currency: PLATFORM_CURRENCY,
      destination: params.connectedAccountId,
    },
    { idempotencyKey: params.idempotencyKey },
  );
  return transfer.id;
}
