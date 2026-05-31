import Stripe from "stripe";

export type SubscriptionInterval = "weekly" | "biweekly" | "monthly";

export const INTERVAL_MAP: Record<
  SubscriptionInterval,
  {
    interval: Stripe.PriceCreateParams.Recurring.Interval;
    interval_count: number;
  }
> = {
  weekly: { interval: "week", interval_count: 1 },
  biweekly: { interval: "week", interval_count: 2 },
  monthly: { interval: "month", interval_count: 1 },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function getOrCreateStripeProduct(
  connectedAccountId: string,
  listingId: string,
  title: string,
): Promise<string> {
  const stripe = getStripe();
  const product = await stripe.products.create(
    { name: title, metadata: { listing_id: listingId } },
    { stripeAccount: connectedAccountId },
  );
  return product.id;
}

export async function createStripePrice(
  connectedAccountId: string,
  productId: string,
  interval: SubscriptionInterval,
  priceInCents: number,
): Promise<string> {
  const stripe = getStripe();
  const { interval: stripeInterval, interval_count } = INTERVAL_MAP[interval];
  const price = await stripe.prices.create(
    {
      product: productId,
      unit_amount: priceInCents,
      currency: "cad",
      recurring: { interval: stripeInterval, interval_count },
    },
    { stripeAccount: connectedAccountId },
  );
  return price.id;
}

export async function archiveStripePrice(
  connectedAccountId: string,
  priceId: string,
): Promise<void> {
  const stripe = getStripe();
  await stripe.prices.update(
    priceId,
    { active: false },
    { stripeAccount: connectedAccountId },
  );
}

export async function getOrCreateStripeCustomer(
  email: string,
  name: string,
): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}

export async function createStripeSubscription(params: {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  applicationFeePct: number;
  connectedAccountId: string;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    default_payment_method: params.paymentMethodId,
    application_fee_percent: params.applicationFeePct,
    transfer_data: { destination: params.connectedAccountId },
    payment_settings: {
      payment_method_options: {
        card: { capture_method: "manual" },
      },
      save_default_payment_method: "on_subscription",
    },
  });
}

export async function cancelStripeSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean,
): Promise<void> {
  const stripe = getStripe();
  if (atPeriodEnd) {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    await stripe.subscriptions.cancel(subscriptionId);
  }
}
