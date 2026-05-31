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

const PLATFORM_CURRENCY = "cad" as const;

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  }
  return _stripe;
}

export async function getOrCreateStripeProduct(
  connectedAccountId: string,
  listingId: string,
  title: string,
): Promise<string> {
  try {
    const stripe = getStripe();
    const results = await stripe.products.search(
      { query: `metadata['listing_id']:'${listingId}'`, limit: 1 },
      { stripeAccount: connectedAccountId },
    );
    if (results.data.length > 0) return results.data[0].id;
    const product = await stripe.products.create(
      { name: title, metadata: { listing_id: listingId } },
      { stripeAccount: connectedAccountId },
    );
    return product.id;
  } catch (err) {
    throw new Error(
      `Stripe getOrCreateStripeProduct failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function createStripePrice(
  connectedAccountId: string,
  productId: string,
  interval: SubscriptionInterval,
  priceInCents: number,
): Promise<string> {
  try {
    const stripe = getStripe();
    const { interval: stripeInterval, interval_count } = INTERVAL_MAP[interval];
    const price = await stripe.prices.create(
      {
        product: productId,
        unit_amount: priceInCents,
        currency: PLATFORM_CURRENCY,
        recurring: { interval: stripeInterval, interval_count },
      },
      { stripeAccount: connectedAccountId },
    );
    return price.id;
  } catch (err) {
    throw new Error(
      `Stripe createStripePrice failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function archiveStripePrice(
  connectedAccountId: string,
  priceId: string,
): Promise<void> {
  try {
    const stripe = getStripe();
    await stripe.prices.update(
      priceId,
      { active: false },
      { stripeAccount: connectedAccountId },
    );
  } catch (err) {
    throw new Error(
      `Stripe archiveStripePrice failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getOrCreateStripeCustomer(
  email: string,
  name: string,
): Promise<string> {
  try {
    const stripe = getStripe();
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) return existing.data[0].id;
    const customer = await stripe.customers.create({ email, name });
    return customer.id;
  } catch (err) {
    throw new Error(
      `Stripe getOrCreateStripeCustomer failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function createStripeSubscription(params: {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  applicationFeePct: number;
  connectedAccountId: string;
}): Promise<Stripe.Subscription> {
  try {
    const stripe = getStripe();
    return stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      default_payment_method: params.paymentMethodId,
      application_fee_percent: params.applicationFeePct,
      transfer_data: { destination: params.connectedAccountId },
      payment_settings: {
        payment_method_options: {
          card: {
            capture_method: "manual",
          } as Stripe.SubscriptionCreateParams.PaymentSettings.PaymentMethodOptions.Card,
        },
        save_default_payment_method: "on_subscription",
      },
    });
  } catch (err) {
    throw new Error(
      `Stripe createStripeSubscription failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function cancelStripeSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean,
): Promise<void> {
  try {
    const stripe = getStripe();
    if (atPeriodEnd) {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(subscriptionId);
    }
  } catch (err) {
    throw new Error(
      `Stripe cancelStripeSubscription failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
