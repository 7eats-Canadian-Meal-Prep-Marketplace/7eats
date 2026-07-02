/**
 * One-time script: registers the two Stripe webhook endpoints for production.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... pnpm exec tsx scripts/setup-stripe-webhooks.ts
 *
 * Outputs the signing secrets — copy them into your hosting env vars:
 *   STRIPE_WEBHOOK_SECRET        (platform webhook)
 *   STRIPE_CONNECT_WEBHOOK_SECRET (connect webhook)
 */

import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret || !secret.startsWith("sk_")) {
  console.error("ERROR: Set STRIPE_SECRET_KEY=sk_live_... before running.");
  process.exit(1);
}

const stripe = new Stripe(secret);
const WEBHOOK_URL = "https://7eats.ca/api/webhooks/stripe";

// Events fired on your platform account (subscriptions, charges, invoices)
const PLATFORM_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "payment_intent.payment_failed",
  "charge.dispute.created",
  "charge.refunded",
];

// Events fired on connected cook accounts (payouts, account status)
const CONNECT_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "payout.created",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  "account.updated",
];

async function main() {
  console.log(`\nSetting up Stripe webhooks for ${WEBHOOK_URL}\n`);

  // Check for existing endpoints to avoid duplicates
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const existingUrls = existing.data.map((e) => e.url);

  // ── Platform webhook ──────────────────────────────────────────────────────
  if (existingUrls.includes(WEBHOOK_URL)) {
    console.log(
      "⚠  An endpoint already exists for this URL. Skipping platform webhook creation.",
    );
    console.log(
      "   To regenerate secrets, delete existing endpoints in the Stripe Dashboard first.\n",
    );
  } else {
    const platform = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: PLATFORM_EVENTS,
      description: "7eats — platform events",
    });

    console.log("✓ Platform webhook created");
    console.log(`  ID:     ${platform.id}`);
    console.log(`  Events: ${PLATFORM_EVENTS.join(", ")}`);
    console.log(`\n  ┌─────────────────────────────────────────────────────┐`);
    console.log(`  │  STRIPE_WEBHOOK_SECRET=${platform.secret}  │`);
    console.log(`  └─────────────────────────────────────────────────────┘\n`);
  }

  // ── Connect webhook ───────────────────────────────────────────────────────
  const connectEndpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: CONNECT_EVENTS,
    connect: true,
    description: "7eats — connected account events (payouts)",
  });

  console.log("✓ Connect webhook created");
  console.log(`  ID:     ${connectEndpoint.id}`);
  console.log(`  Events: ${CONNECT_EVENTS.join(", ")}`);
  console.log(
    `\n  ┌─────────────────────────────────────────────────────────────┐`,
  );
  console.log(
    `  │  STRIPE_CONNECT_WEBHOOK_SECRET=${connectEndpoint.secret}  │`,
  );
  console.log(
    `  └─────────────────────────────────────────────────────────────┘\n`,
  );

  console.log("Next steps:");
  console.log(
    "  1. Add STRIPE_WEBHOOK_SECRET to your production env vars (Vercel / .env.local for live)",
  );
  console.log(
    "  2. Add STRIPE_CONNECT_WEBHOOK_SECRET to your production env vars",
  );
  console.log(
    "  3. Update the webhook route to verify connect events with the second secret (see note below)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
