"use client";

import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";
import styles from "./page.module.css";

type Props = {
  onTokenized: (paymentMethodId: string) => Promise<void>;
  loading: boolean;
};

/**
 * Renders a Stripe CardElement for new-card entry.
 * On submit it creates a PaymentMethod via Stripe.js (no raw card data is
 * ever sent to our server) and hands the resulting paymentMethodId back to
 * the parent via onTokenized.
 */
export function NewCardForm({ onTokenized, loading }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState("");
  const [cardComplete, setCardComplete] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;

    setCardError("");

    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: "card",
      card: cardEl,
    });

    if (error) {
      setCardError(error.message ?? "Card error. Please try again.");
      return;
    }

    await onTokenized(paymentMethod.id);
  }

  return (
    <form id="new-card-form" onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="card-element">
          Card details
        </label>
        <div className={styles.stripeCardWrapper}>
          <CardElement
            id="card-element"
            options={{
              style: {
                base: {
                  fontSize: "15px",
                  color: "#1a1a1a",
                  fontFamily: "inherit",
                  "::placeholder": { color: "#aaa" },
                },
                invalid: { color: "#e53e3e" },
              },
              hidePostalCode: true,
            }}
            onChange={(e) => {
              setCardComplete(e.complete);
              if (e.error) {
                setCardError(e.error.message ?? "");
              } else {
                setCardError("");
              }
            }}
          />
        </div>
        {cardError && (
          <p className={styles.fieldError} role="alert">
            {cardError}
          </p>
        )}
      </div>

      <button
        type="submit"
        className={styles.placeOrderBtn}
        disabled={loading || !stripe || !cardComplete}
        style={{ width: "100%", marginTop: "0.75rem" }}
      >
        {loading ? "Processing…" : "Place Order"}
      </button>
    </form>
  );
}
