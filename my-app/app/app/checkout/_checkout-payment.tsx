"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { forwardRef } from "react";
import {
  CheckoutPaymentForm,
  type CheckoutPaymentHandle,
} from "./_payment-form";
import styles from "./page.module.css";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

type Props = {
  clientSecret: string | null;
  onReadyChange: (ready: boolean) => void;
};

export type { CheckoutPaymentHandle };

export const CheckoutPaymentSection = forwardRef<CheckoutPaymentHandle, Props>(
  function CheckoutPaymentSection({ clientSecret, onReadyChange }, ref) {
    if (!clientSecret) {
      return (
        <p className={styles.paymentPendingHint}>
          Continue below to load secure payment options for your order total.
        </p>
      );
    }

    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#d64045",
              borderRadius: "8px",
            },
          },
        }}
      >
        <CheckoutPaymentForm ref={ref} onReadyChange={onReadyChange} />
      </Elements>
    );
  },
);
