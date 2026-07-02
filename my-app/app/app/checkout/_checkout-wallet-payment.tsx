"use client";

import { Elements } from "@stripe/react-stripe-js";
import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { stripeElementsAppearance, stripePromise } from "@/lib/stripe/browser";
import { formatStripeCardError } from "@/lib/stripe/card-errors";
import { Skeleton } from "../_skeleton";
import {
  CheckoutPaymentForm,
  type CheckoutPaymentHandle,
} from "./_payment-form";
import styles from "./page.module.css";

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
};

type Props = {
  clientSecret: string;
  userEmail: string | null;
  onReadyChange: (ready: boolean) => void;
};

export const CheckoutWalletPayment = forwardRef<CheckoutPaymentHandle, Props>(
  function CheckoutWalletPayment(
    { clientSecret, userEmail, onReadyChange },
    ref,
  ) {
    const newCardRef = useRef<CheckoutPaymentHandle>(null);
    const [cards, setCards] = useState<SavedCard[]>([]);
    const [cardsLoading, setCardsLoading] = useState(true);
    const [cardsError, setCardsError] = useState<string | null>(null);
    const [selection, setSelection] = useState<"new" | string | null>(null);

    useEffect(() => {
      let cancelled = false;
      setCardsLoading(true);
      setCardsError(null);
      fetch("/api/checkout/payment-methods")
        .then(async (res) => {
          if (!res.ok) {
            const json = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(json.error ?? "Could not load saved cards.");
          }
          return res.json() as Promise<{ data?: SavedCard[] }>;
        })
        .then((json) => {
          if (cancelled) return;
          const loaded = json.data ?? [];
          setCards(loaded);
          setSelection(loaded[0]?.id ?? "new");
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setCards([]);
          setSelection("new");
          setCardsError(
            err instanceof Error ? err.message : "Could not load saved cards.",
          );
        })
        .finally(() => {
          if (!cancelled) setCardsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (cardsLoading || selection === null) {
        onReadyChange(false);
        return;
      }
      if (selection !== "new") {
        onReadyChange(true);
      }
    }, [cardsLoading, selection, onReadyChange]);

    useImperativeHandle(
      ref,
      () => ({
        async confirmPayment() {
          if (selection === null) {
            return { ok: false, error: "Choose how you want to pay." };
          }

          if (selection !== "new") {
            const stripe = await stripePromise;
            if (!stripe) {
              return {
                ok: false,
                error: "Payment form is still loading.",
              };
            }

            const { error, paymentIntent } = await stripe.confirmPayment({
              clientSecret,
              confirmParams: {
                payment_method: selection,
                return_url: `${window.location.origin}/app/checkout`,
              },
              redirect: "if_required",
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
          }

          return (
            newCardRef.current?.confirmPayment() ?? {
              ok: false,
              error: "Payment form is still loading.",
            }
          );
        },
      }),
      [clientSecret, selection],
    );

    if (cardsLoading) {
      return (
        <div className={styles.walletList} aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className={styles.walletRow}>
              <Skeleton circle width={18} height={18} />
              <Skeleton width={18} height={18} radius={4} />
              <Skeleton width={64} height={14} radius={6} />
              <Skeleton width={72} height={14} radius={6} />
            </div>
          ))}
        </div>
      );
    }

    const showWallet = cards.length > 0;

    return (
      <div className={styles.formGroup}>
        {cardsError && (
          <p className={styles.paymentHint}>
            {cardsError} You can still pay with a new card below.
          </p>
        )}

        {showWallet && (
          <>
            <p className={styles.paymentHint}>
              Choose a saved card or pay with a new one.
            </p>
            <div className={styles.walletList}>
              {cards.map((card) => {
                const active = selection === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`${styles.walletRow} ${active ? styles.walletRowActive : ""}`}
                    onClick={() => setSelection(card.id)}
                  >
                    <span className={styles.walletRadio} aria-hidden>
                      {active ? (
                        <span className={styles.walletRadioDot} />
                      ) : null}
                    </span>
                    <CreditCard size={18} className={styles.walletAddIcon} />
                    <span className={styles.walletCardBrand}>{card.brand}</span>
                    <span className={styles.walletCardNum}>
                      ···· {card.last4}
                    </span>
                    <span className={styles.walletCardExp}>
                      {card.expMonth
                        ? card.expMonth.toString().padStart(2, "0")
                        : "??"}
                      /{card.expYear ? card.expYear.toString().slice(-2) : "??"}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`${styles.walletRow} ${styles.walletRowAdd} ${
                  selection === "new" ? styles.walletRowActive : ""
                }`}
                onClick={() => setSelection("new")}
              >
                <span className={styles.walletRadio} aria-hidden>
                  {selection === "new" ? (
                    <span className={styles.walletRadioDot} />
                  ) : null}
                </span>
                <Plus size={18} className={styles.walletAddIcon} />
                <span className={styles.walletAddLabel}>Use a new card</span>
              </button>
            </div>
            <p className={styles.paymentHint}>
              To remove a card, go to{" "}
              <Link href="/app/settings" className={styles.termsLink}>
                Account settings
              </Link>
              .
            </p>
          </>
        )}

        {(!showWallet || selection === "new") && (
          <div className={showWallet ? styles.newCardForm : undefined}>
            {!showWallet && (
              <p className={styles.paymentHint}>
                Pay with your card. It will be saved to your account for next
                time.
              </p>
            )}
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: stripeElementsAppearance,
              }}
            >
              <CheckoutPaymentForm
                ref={newCardRef}
                onReadyChange={onReadyChange}
                variant="new-card"
                userEmail={userEmail}
              />
            </Elements>
          </div>
        )}
      </div>
    );
  },
);
