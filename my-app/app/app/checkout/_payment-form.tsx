"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import styles from "./page.module.css";

export type CheckoutPaymentHandle = {
  confirmPayment: () => Promise<{ ok: boolean; error?: string }>;
};

type Props = {
  onReadyChange: (ready: boolean) => void;
};

export const CheckoutPaymentForm = forwardRef<CheckoutPaymentHandle, Props>(
  function CheckoutPaymentForm({ onReadyChange }, ref) {
    const stripe = useStripe();
    const elements = useElements();

    useEffect(() => {
      onReadyChange(Boolean(stripe && elements));
    }, [stripe, elements, onReadyChange]);

    useImperativeHandle(
      ref,
      () => ({
        async confirmPayment() {
          if (!stripe || !elements) {
            return { ok: false, error: "Payment form is still loading." };
          }

          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: "if_required",
          });

          if (error) {
            return {
              ok: false,
              error: error.message ?? "Payment failed. Please try again.",
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
      [stripe, elements],
    );

    return (
      <div className={styles.formGroup}>
        <div className={styles.stripeCardWrapper}>
          <PaymentElement
            id="payment-element"
            options={{
              layout: "tabs",
            }}
            onReady={() => onReadyChange(true)}
          />
        </div>
      </div>
    );
  },
);
