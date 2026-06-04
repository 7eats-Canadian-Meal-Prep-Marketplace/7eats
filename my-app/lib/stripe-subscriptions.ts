import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

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

export async function getOrCreateStripeProduct(
  listingId: string,
  title: string,
): Promise<string> {
  try {
    const stripe = getStripe();
    const results = await stripe.products.search({
      query: `metadata['listing_id']:'${listingId}'`,
      limit: 1,
    });
    if (results.data.length > 0) return results.data[0].id;
    const product = await stripe.products.create({
      name: title,
      metadata: { listing_id: listingId },
    });
    return product.id;
  } catch (err) {
    throw new Error(
      `Stripe getOrCreateStripeProduct failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function createStripePrice(
  productId: string,
  interval: SubscriptionInterval,
  priceInCents: number,
): Promise<string> {
  try {
    const stripe = getStripe();
    const { interval: stripeInterval, interval_count } = INTERVAL_MAP[interval];
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: priceInCents,
      currency: PLATFORM_CURRENCY,
      recurring: { interval: stripeInterval, interval_count },
    });
    return price.id;
  } catch (err) {
    throw new Error(
      `Stripe createStripePrice failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function archiveStripePrice(priceId: string): Promise<void> {
  try {
    const stripe = getStripe();
    await stripe.prices.update(priceId, { active: false });
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
      on_behalf_of: params.connectedAccountId,
      payment_settings: {
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
