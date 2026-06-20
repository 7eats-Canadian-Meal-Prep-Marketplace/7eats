"use client";

import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { forwardRef, useImperativeHandle } from "react";
import styles from "./page.module.css";

export type CheckoutCardHandle = {
  tokenize: () => Promise<string | null>;
};

type Props = {
  cardError: string;
  onCardError: (msg: string) => void;
  onCardCompleteChange: (complete: boolean) => void;
};

/**
 * Stripe CardElement for checkout. Tokenization is triggered by the parent
 * (after cancellation consent) via ref — no submit button here.
 */
export const CheckoutCardForm = forwardRef<CheckoutCardHandle, Props>(
  function CheckoutCardForm(
    { cardError, onCardError, onCardCompleteChange },
    ref,
  ) {
    const stripe = useStripe();
    const elements = useElements();

    useImperativeHandle(
      ref,
      () => ({
        async tokenize() {
          if (!stripe || !elements) return null;

          const cardEl = elements.getElement(CardElement);
          if (!cardEl) return null;

          onCardError("");

          const { paymentMethod, error } = await stripe.createPaymentMethod({
            type: "card",
            card: cardEl,
          });

          if (error) {
            onCardError(error.message ?? "Card error. Please try again.");
            return null;
          }

          return paymentMethod.id;
        },
      }),
      [stripe, elements, onCardError],
    );

    return (
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
              onCardCompleteChange(e.complete);
              if (e.error) {
                onCardError(e.error.message ?? "");
              } else {
                onCardError("");
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
    );
  },
);
