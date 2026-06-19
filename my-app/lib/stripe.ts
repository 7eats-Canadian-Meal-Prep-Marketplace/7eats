import Stripe from "stripe";

// Connect accounts are created via Accounts v2 (see lib/stripe-connect.ts), but
// Express dashboard login links have no v2 equivalent — the dashboard-link route
// still calls v1 `accounts.createLoginLink`, which makes Stripe attach a
// `stripe-notice` header recommending Accounts v2. The SDK re-emits it as a Node
// process warning. It's informational, not an error, and unavoidable for that one
// call, so suppress this single notice while leaving every other warning intact.
function silenceAccountsV2Notice(): void {
  const proc = typeof process !== "undefined" ? process : undefined;
  if (!proc || typeof proc.emitWarning !== "function") return;

  const patched = proc as typeof proc & { __stripeNoticePatched?: boolean };
  if (patched.__stripeNoticePatched) return;
  patched.__stripeNoticePatched = true;

  const original = proc.emitWarning.bind(proc);
  proc.emitWarning = ((warning, ...args: unknown[]) => {
    const message = typeof warning === "string" ? warning : warning?.message;
    if (message?.includes("Accounts v2")) return;
    // biome-ignore lint/suspicious/noExplicitAny: passthrough preserves all overloads
    return original(warning as any, ...(args as any[]));
  }) as typeof proc.emitWarning;
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    silenceAccountsV2Notice();
    _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  }
  return _stripe;
}
