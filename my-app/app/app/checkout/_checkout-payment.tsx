"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { forwardRef } from "react";
import {
  CheckoutPaymentForm,
  type CheckoutPaymentHandle,
} from "./_payment-form";

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
    // The parent only mounts this once a payment session exists; this guard is
    // just defensive — render nothing rather than an empty-state placeholder.
    if (!clientSecret) return null;

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
