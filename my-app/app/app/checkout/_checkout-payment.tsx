"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Plus } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { CheckoutCardForm, type CheckoutCardHandle } from "./_payment-form";
import styles from "./page.module.css";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
};

export type CheckoutPaymentHandle = {
  resolvePaymentMethodId: () => Promise<string | null>;
};

type Props = {
  isLoggedIn: boolean;
  onReadyChange: (ready: boolean) => void;
};

function formatBrand(brand: string): string {
  if (brand === "amex") return "Amex";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

const CheckoutPaymentInner = forwardRef<CheckoutPaymentHandle, Props>(
  function CheckoutPaymentInner({ isLoggedIn, onReadyChange }, ref) {
    const cardRef = useRef<CheckoutCardHandle>(null);
    const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
    const [cardsLoading, setCardsLoading] = useState(isLoggedIn);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [useNewCard, setUseNewCard] = useState(!isLoggedIn);
    const [cardComplete, setCardComplete] = useState(false);
    const [cardError, setCardError] = useState("");

    useEffect(() => {
      if (!isLoggedIn) {
        setSavedCards([]);
        setCardsLoading(false);
        setUseNewCard(true);
        setSelectedCardId(null);
        return;
      }

      let cancelled = false;
      setCardsLoading(true);
      fetch("/api/checkout/payment-methods")
        .then((r) => r.json())
        .then((json: { data?: SavedCard[] }) => {
          if (cancelled) return;
          const cards = json.data ?? [];
          setSavedCards(cards);
          if (cards.length > 0) {
            setSelectedCardId(cards[0].id);
            setUseNewCard(false);
          } else {
            setUseNewCard(true);
            setSelectedCardId(null);
          }
        })
        .catch(() => {
          if (!cancelled) setUseNewCard(true);
        })
        .finally(() => {
          if (!cancelled) setCardsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [isLoggedIn]);

    const paymentReady =
      useNewCard || savedCards.length === 0
        ? cardComplete
        : Boolean(selectedCardId);

    useEffect(() => {
      onReadyChange(paymentReady);
    }, [paymentReady, onReadyChange]);

    useImperativeHandle(
      ref,
      () => ({
        async resolvePaymentMethodId() {
          if (isLoggedIn && !useNewCard && selectedCardId) {
            return selectedCardId;
          }
          return cardRef.current?.tokenize() ?? null;
        },
      }),
      [isLoggedIn, useNewCard, selectedCardId],
    );

    function selectSavedCard(id: string) {
      setUseNewCard(false);
      setSelectedCardId(id);
      setCardError("");
    }

    function selectNewCard() {
      setUseNewCard(true);
      setCardError("");
    }

    if (isLoggedIn && cardsLoading) {
      return <p className={styles.loadingCards}>Loading payment methods…</p>;
    }

    const showWallet = isLoggedIn && savedCards.length > 0;

    return (
      <>
        {showWallet && (
          <div className={styles.walletList}>
            {savedCards.map((card) => {
              const active = !useNewCard && selectedCardId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  className={
                    active
                      ? `${styles.walletRow} ${styles.walletRowActive}`
                      : styles.walletRow
                  }
                  onClick={() => selectSavedCard(card.id)}
                >
                  <span className={styles.walletRadio} aria-hidden>
                    {active && <span className={styles.walletRadioDot} />}
                  </span>
                  <span className={styles.walletCardBrand}>
                    {formatBrand(card.brand)}
                  </span>
                  <span className={styles.walletCardNum}>
                    •••• {card.last4}
                  </span>
                  {card.expMonth != null && card.expYear != null && (
                    <span className={styles.walletCardExp}>
                      {String(card.expMonth).padStart(2, "0")}/
                      {String(card.expYear).slice(-2)}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              className={`${styles.walletRow} ${styles.walletRowAdd}`}
              onClick={selectNewCard}
            >
              <span className={styles.walletRadio} aria-hidden>
                {useNewCard && <span className={styles.walletRadioDot} />}
              </span>
              <Plus size={16} className={styles.walletAddIcon} aria-hidden />
              <span className={styles.walletAddLabel}>
                Use a different card
              </span>
            </button>
            {useNewCard && (
              <div className={styles.newCardForm}>
                <CheckoutCardForm
                  ref={cardRef}
                  cardError={cardError}
                  onCardError={setCardError}
                  onCardCompleteChange={setCardComplete}
                />
              </div>
            )}
          </div>
        )}

        {(!showWallet || (isLoggedIn && savedCards.length === 0)) && (
          <CheckoutCardForm
            ref={cardRef}
            cardError={cardError}
            onCardError={setCardError}
            onCardCompleteChange={setCardComplete}
          />
        )}
      </>
    );
  },
);

export const CheckoutPaymentSection = forwardRef<CheckoutPaymentHandle, Props>(
  function CheckoutPaymentSection(props, ref) {
    return (
      <Elements stripe={stripePromise}>
        <CheckoutPaymentInner ref={ref} {...props} />
      </Elements>
    );
  },
);
