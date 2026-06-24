"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  checkoutNewCardPaymentElementOptions,
  checkoutPaymentElementOptions,
} from "@/lib/stripe/browser";
import {
  formatStripeCardError,
  stripeCardBillingConfirmParams,
} from "@/lib/stripe/card-errors";
import styles from "./page.module.css";

export type CheckoutPaymentHandle = {
  confirmPayment: () => Promise<{ ok: boolean; error?: string }>;
};

type Props = {
  onReadyChange: (ready: boolean) => void;
  /** Guest checkout vs logged-in "add new card". */
  variant?: "guest" | "new-card";
  userEmail?: string | null;
};

export const CheckoutPaymentForm = forwardRef<CheckoutPaymentHandle, Props>(
  function CheckoutPaymentForm(
    { onReadyChange, variant = "guest", userEmail },
    ref,
  ) {
    const stripe = useStripe();
    const elements = useElements();
    const [elementReady, setElementReady] = useState(false);
    const [formComplete, setFormComplete] = useState(false);
    const [postalCode, setPostalCode] = useState("");

    const isNewCard = variant === "new-card";
    const postalComplete = !isNewCard || postalCode.trim().length >= 3;
    const paymentReady = Boolean(
      stripe && elements && elementReady && formComplete && postalComplete,
    );

    useEffect(() => {
      onReadyChange(paymentReady);
    }, [paymentReady, onReadyChange]);

    useImperativeHandle(
      ref,
      () => ({
        async confirmPayment() {
          if (!stripe || !elements) {
            return { ok: false, error: "Payment form is still loading." };
          }

          if (isNewCard && !postalComplete) {
            return { ok: false, error: "Enter the postal code for this card." };
          }

          const billingParams = isNewCard
            ? stripeCardBillingConfirmParams({
                email: userEmail,
                postalCode: postalCode.trim(),
              })
            : {};

          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: "if_required",
            confirmParams: {
              return_url: `${window.location.origin}/app/checkout`,
              ...billingParams,
            },
          });

          if (error) {
            return {
              ok: false,
              error: formatStripeCardError(
                error,
                "Payment failed. Please try again.",
              ),
            };
          }

          if (paymentIntent?.status !== "requires_capture") {
            return {
              ok: false,
              error: "Payment could not be authorized. Try another method.",
            };
          }

          return { ok: true };
        },
      }),
      [stripe, elements, isNewCard, postalComplete, postalCode, userEmail],
    );

    const elementOptions = isNewCard
      ? checkoutNewCardPaymentElementOptions
      : checkoutPaymentElementOptions;

    return (
      <div className={styles.formGroup}>
        {variant === "guest" && (
          <p className={styles.paymentHint}>
            Enter your card details to pay for this order.
          </p>
        )}
        <div className={styles.stripeCardWrapper}>
          <PaymentElement
            id="payment-element"
            options={elementOptions}
            onReady={() => setElementReady(true)}
            onChange={(event) => setFormComplete(event.complete)}
          />
        </div>
        {isNewCard && elementReady && (
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="checkout-card-postal">
              Postal code
            </label>
            <input
              id="checkout-card-postal"
              className={styles.input}
              type="text"
              autoComplete="postal-code"
              placeholder="A1A 1A1"
              value={postalCode}
              maxLength={12}
              onChange={(event) => setPostalCode(event.target.value)}
            />
          </div>
        )}
      </div>
    );
  },
);
