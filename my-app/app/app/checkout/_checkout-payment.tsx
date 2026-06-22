"use client";

import { Elements } from "@stripe/react-stripe-js";
import { forwardRef } from "react";
import { stripeElementsAppearance, stripePromise } from "@/lib/stripe/browser";
import { CheckoutWalletPayment } from "./_checkout-wallet-payment";
import {
  CheckoutPaymentForm,
  type CheckoutPaymentHandle,
} from "./_payment-form";

type Props = {
  clientSecret: string | null;
  isLoggedIn: boolean;
  userEmail: string | null;
  onReadyChange: (ready: boolean) => void;
};

export type { CheckoutPaymentHandle };

export const CheckoutPaymentSection = forwardRef<CheckoutPaymentHandle, Props>(
  function CheckoutPaymentSection(
    { clientSecret, isLoggedIn, userEmail, onReadyChange },
    ref,
  ) {
    if (!clientSecret) return null;

    if (isLoggedIn) {
      return (
        <CheckoutWalletPayment
          ref={ref}
          clientSecret={clientSecret}
          userEmail={userEmail}
          onReadyChange={onReadyChange}
        />
      );
    }

    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: stripeElementsAppearance,
        }}
      >
        <CheckoutPaymentForm
          ref={ref}
          onReadyChange={onReadyChange}
          variant="guest"
        />
      </Elements>
    );
  },
);
