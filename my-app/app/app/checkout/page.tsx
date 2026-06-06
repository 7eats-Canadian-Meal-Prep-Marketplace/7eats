"use client";

import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Lock,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useApp } from "../_app-context";
import { useCart } from "../_cart-context";
import { type CartItem, MOCK_LISTINGS } from "../_mock";
import { WEEKLY_CHARGE_DISCLAIMER } from "../_subscription-utils";
import {
  calcOntarioHst,
  formatCartMoney,
  ONTARIO_HST_LABEL,
} from "../cart/_cart-tax";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckoutStep = "details" | "payment";

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type DeliveryAddress = {
  street: string;
  unit: string;
  city: string;
  province: string;
  postal: string;
};

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
};

const EMPTY_CONTACT: ContactForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const EMPTY_ADDRESS: DeliveryAddress = {
  street: "",
  unit: "",
  city: "",
  province: "ON",
  postal: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardBrandLabel(brand: string): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
  };
  return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function CheckoutInner() {
  const { items, total, clearCart, cartMode, needsDeliveryAddress } = useCart();
  const { isLoggedIn } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isSubscriptionCart =
    cartMode === "subscription" || cartMode === "mixed";

  const initialStep =
    (searchParams.get("step") as CheckoutStep | null) ?? "details";
  const [step, setStep] = useState<CheckoutStep>(
    initialStep === "payment" && isLoggedIn ? "payment" : initialStep,
  );

  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT);
  const [address, setAddress] = useState<DeliveryAddress>(EMPTY_ADDRESS);
  const [editingAddress, setEditingAddress] = useState(false);
  const [ordered, setOrdered] = useState(false);

  // Payment method selection
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | "new">("new");

  // New card fields (raw values — Stripe.js tokenizes on submit, never sent to server)
  const [rawCard, setRawCard] = useState({ number: "", expiry: "", cvv: "" });

  // Subscription consent — one checkbox per distinct subscription listing
  const subscriptionListingIds = useMemo(
    () => [
      ...new Set(
        items
          .filter((i) => i.orderType === "subscription")
          .map((i) => i.listingId),
      ),
    ],
    [items],
  );
  const [subscriptionConsent, setSubscriptionConsent] = useState<
    Record<string, boolean>
  >({});

  // All subscription consent boxes must be ticked before placing order
  const allConsentGiven = subscriptionListingIds.every(
    (id) => subscriptionConsent[id] === true,
  );

  // A valid payment method must be selected or entered before placing
  const hasValidCard = useMemo(() => {
    if (selectedCardId !== "new") return true; // saved card selected
    return rawCard.number.trim().length >= 15; // new card number entered
  }, [selectedCardId, rawCard.number]);

  // Fetch saved cards when logged-in user reaches payment step.
  // Falls back to mock cards in dev so the UI is always testable.
  useEffect(() => {
    if (!isLoggedIn || step !== "payment") return;
    setLoadingCards(true);
    fetch("/api/checkout/payment-methods")
      .then((r) => r.json())
      .then((data: { data?: SavedCard[] }) => {
        const cards = data.data ?? [];
        if (cards.length > 0) {
          setSavedCards(cards);
          setSelectedCardId(cards[0].id);
        } else {
          // Mock cards for dev/visualization
          const mock: SavedCard[] = [
            {
              id: "pm_mock_visa",
              brand: "visa",
              last4: "4242",
              expMonth: 12,
              expYear: 27,
            },
            {
              id: "pm_mock_mc",
              brand: "mastercard",
              last4: "5555",
              expMonth: 8,
              expYear: 26,
            },
          ];
          setSavedCards(mock);
          setSelectedCardId(mock[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCards(false));
  }, [isLoggedIn, step]);

  // Pre-fill contact from real session + saved address for logged-in users
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/auth/get-session")
      .then((r) => r.json())
      .then((data) => {
        const u = data?.user;
        if (!u) return;
        setContact({
          firstName:
            (u.firstName as string | undefined) ?? u.name?.split(" ")[0] ?? "",
          lastName:
            (u.lastName as string | undefined) ??
            u.name?.split(" ").slice(1).join(" ") ??
            "",
          email: u.email ?? "",
          phone: (u.phone as string | undefined) ?? "",
        });
      })
      .catch(() => {});
    // Delivery address: set from user's saved address once address book is wired
    setAddress({
      street: "123 King St W",
      unit: "Apt 4B",
      city: "Toronto",
      province: "ON",
      postal: "M5H 1A1",
    });
  }, [isLoggedIn]);

  // Block direct access and redirect when cart empties (unless mid-order or post-order)
  useEffect(() => {
    if (items.length === 0 && !placing && !ordered) router.replace("/app/cart");
  }, [items.length, placing, ordered, router]);

  // All hooks must run before any early return
  const steps = useMemo(
    () => [
      { id: "details" as const, label: "Details" },
      { id: "payment" as const, label: "Payment" },
    ],
    [],
  );

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.cookId]) acc[item.cookId] = [];
    acc[item.cookId].push(item);
    return acc;
  }, {});

  const { tax, grandTotal } = useMemo(() => {
    const taxAmount = calcOntarioHst(total);
    return {
      tax: taxAmount,
      grandTotal: Math.round((total + taxAmount) * 100) / 100,
    };
  }, [total]);

  const placeCTACopy = useMemo(() => {
    const amount = `$${formatCartMoney(grandTotal)}`;
    if (placing) {
      if (cartMode === "subscription") return "Subscribing…";
      if (cartMode === "mixed") return "Processing…";
      return "Paying…";
    }
    if (cartMode === "one-time") return `Pay · ${amount}`;
    if (cartMode === "subscription") return `Subscribe · ${amount}`;
    return `Pay & Subscribe · ${amount}`;
  }, [placing, cartMode, grandTotal]);

  // Early return — all hooks above have already run
  if (items.length === 0 && !placing && !ordered) return null;

  // ── Validation ────────────────────────────────────────────────────────────────

  function validateDetails(): boolean {
    // Unauthenticated users must sign in before proceeding
    if (!isLoggedIn) {
      router.push(
        `/app-auth/login?next=${encodeURIComponent("/app/checkout?step=payment")}`,
      );
      return false;
    }
    const e: Record<string, string> = {};
    if (needsDeliveryAddress && !editingAddress) {
      if (!address.street.trim()) e.street = "Required";
      if (!address.city.trim()) e.city = "Required";
      if (!address.postal.trim()) e.postal = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validatePayment(): boolean {
    const e: Record<string, string> = {};
    if (selectedCardId === "new") {
      if (!rawCard.number.trim()) e.card = "Required";
      if (!rawCard.expiry.trim()) e.expiry = "Required";
      if (!rawCard.cvv.trim()) e.cvv = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Place order ───────────────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    if (!validatePayment()) return;
    if (!allConsentGiven) {
      setPlaceError(
        "Please confirm your subscription authorization above before placing your order.",
      );
      return;
    }

    setPlacing(true);
    setPlaceError("");

    try {
      // TODO: Before calling /api/orders, tokenize the new card via Stripe.js:
      //   const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      //   const { paymentMethod, error } = await stripe.createPaymentMethod({
      //     type: "card",
      //     card: cardElement, // Stripe CardElement (not raw input)
      //   });
      //   if (error) { setPlaceError(error.message); setPlacing(false); return; }
      //   const paymentMethodId = paymentMethod.id;
      //
      // For subscriptions, use SetupIntent:
      //   const { data: { clientSecret } } = await fetch("/api/checkout/setup-intent", { method: "POST" }).then(r => r.json());
      //   const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, { payment_method: { card: cardElement } });
      //   const paymentMethodId = setupIntent.payment_method;

      const paymentMethodId =
        selectedCardId !== "new" ? selectedCardId : "pm_mock_new_card";

      // One order per cook group.
      // TODO: replace with real POST /api/orders calls (one per cook group),
      // passing { listingIds, quantity, paymentMethodId, pickupAt, ... }.
      // Partial failure → cancel already-created PIs before surfacing error.
      const cookGroups = Object.entries(grouped);
      const orderEntries = cookGroups.map(([, cookItems]) => ({
        orderId: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        cookName: cookItems[0].cookName,
        fulfillmentMode: cookItems[0].fulfillmentMode,
        hasSubscription: cookItems.some((i) => i.orderType === "subscription"),
      }));

      console.log("[checkout] would call POST /api/orders per cook with:", {
        paymentMethodId,
        orders: orderEntries,
        deliveryAddress: needsDeliveryAddress ? address : null,
      });

      await new Promise((res) => setTimeout(res, 1000));

      // If a new card was used, mock-add it to saved payment methods
      if (isLoggedIn && selectedCardId === "new" && rawCard.number.trim()) {
        const last4 = rawCard.number.replace(/\s/g, "").slice(-4);
        const newMock: SavedCard = {
          id: `pm_mock_new_${Date.now()}`,
          brand: "visa",
          last4,
          expMonth: 12,
          expYear: 27,
        };
        setSavedCards((prev) => [...prev, newMock]);
        setSelectedCardId(newMock.id);
        setRawCard({ number: "", expiry: "", cvv: "" });
      }

      setOrdered(true);
      clearCart();

      // Encode orders for confirmation page: index-keyed params
      const params = new URLSearchParams();
      orderEntries.forEach((o, i) => {
        params.set(`oid${i}`, o.orderId);
        params.set(`cook${i}`, o.cookName);
        params.set(`mode${i}`, o.fulfillmentMode);
        if (o.hasSubscription) params.set(`sub${i}`, "1");
      });
      params.set("count", String(orderEntries.length));
      router.push(`/app/checkout/confirmation?${params.toString()}`);
    } catch (err) {
      setPlaceError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className={styles.page}>
      <div className={styles.checkoutHeader}>
        <Link href="/app/cart" className={styles.backBtn}>
          <ArrowLeft size={18} />
          Back to cart
        </Link>
        <div className={styles.secureTag}>
          <Lock size={13} />
          Secure checkout
        </div>
      </div>

      <nav className={styles.stepper} aria-label="Checkout progress">
        {steps.map(({ id, label }, index) => {
          const active = step === id;
          const completed = steps.findIndex((s) => s.id === step) > index;
          return (
            <div
              key={id}
              className={`${styles.step} ${active ? styles.stepActive : ""} ${completed ? styles.stepDone : ""}`}
            >
              <span className={styles.stepNum}>{index + 1}</span>
              <span className={styles.stepLabel}>{label}</span>
            </div>
          );
        })}
      </nav>

      <div className={styles.inner}>
        <div className={styles.formSide}>
          {/* ── Step 1: Details ── */}
          {step === "details" && (
            <>
              <section className={styles.formSection}>
                <h2 className={styles.formTitle}>Contact details</h2>

                {/* Logged-in: read-only summary — unauthenticated users are redirected to login by validateDetails() */}
                {isLoggedIn ? (
                  <div className={styles.contactSummary}>
                    <div className={styles.contactRow}>
                      <span className={styles.contactLabel}>Name</span>
                      <span className={styles.contactValue}>
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                    <div className={styles.contactRow}>
                      <span className={styles.contactLabel}>Email</span>
                      <span className={styles.contactValue}>
                        {contact.email}
                      </span>
                    </div>
                    {contact.phone && (
                      <div className={styles.contactRow}>
                        <span className={styles.contactLabel}>Phone</span>
                        <span className={styles.contactValue}>
                          {contact.phone}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>

              {/* Delivery address — only when at least one item requires delivery */}
              {needsDeliveryAddress && (
                <section className={styles.formSection}>
                  <h2 className={styles.formTitle}>Delivery address</h2>

                  {/* Logged-in + saved address + not editing → read-only summary with Edit row */}
                  {isLoggedIn && address.street && !editingAddress ? (
                    <div className={styles.contactSummary}>
                      <div className={styles.contactRow}>
                        <span className={styles.contactLabel}>Street</span>
                        <span className={styles.contactValue}>
                          {address.street}
                          {address.unit ? `, ${address.unit}` : ""}
                        </span>
                      </div>
                      <div className={styles.contactRow}>
                        <span className={styles.contactLabel}>City</span>
                        <span className={styles.contactValue}>
                          {address.city}, {address.province} {address.postal}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.addressEditRow}
                        onClick={() => setEditingAddress(true)}
                      >
                        Edit address
                      </button>
                    </div>
                  ) : (
                    /* Guest or logged-in editing — full form */
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="street">
                          Street address
                        </label>
                        <input
                          id="street"
                          type="text"
                          className={styles.input}
                          value={address.street}
                          onChange={(e) =>
                            setAddress((a) => ({
                              ...a,
                              street: e.target.value,
                            }))
                          }
                        />
                        {errors.street && (
                          <p className={styles.fieldError}>{errors.street}</p>
                        )}
                      </div>
                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.label} htmlFor="unit">
                            Apt / Unit{" "}
                            <span className={styles.optionalLabel}>
                              (optional)
                            </span>
                          </label>
                          <input
                            id="unit"
                            type="text"
                            className={styles.input}
                            value={address.unit}
                            onChange={(e) =>
                              setAddress((a) => ({
                                ...a,
                                unit: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label} htmlFor="postal">
                            Postal code
                          </label>
                          <input
                            id="postal"
                            type="text"
                            className={styles.input}
                            value={address.postal}
                            onChange={(e) =>
                              setAddress((a) => ({
                                ...a,
                                postal: e.target.value,
                              }))
                            }
                          />
                          {errors.postal && (
                            <p className={styles.fieldError}>{errors.postal}</p>
                          )}
                        </div>
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="city">
                          City
                        </label>
                        <input
                          id="city"
                          type="text"
                          className={styles.input}
                          value={address.city}
                          onChange={(e) =>
                            setAddress((a) => ({ ...a, city: e.target.value }))
                          }
                        />
                        {errors.city && (
                          <p className={styles.fieldError}>{errors.city}</p>
                        )}
                      </div>
                      {isLoggedIn && editingAddress && (
                        <button
                          type="button"
                          className={styles.cancelEditBtn}
                          onClick={() => setEditingAddress(false)}
                        >
                          Save
                        </button>
                      )}
                    </>
                  )}
                </section>
              )}

              <section className={styles.formSection}>
                <h2 className={styles.formTitle}>Fulfillment details</h2>
                {Object.entries(grouped).map(([cookId, cookItems]) => {
                  const first = cookItems[0];
                  const listing = MOCK_LISTINGS.find(
                    (l) => l.id === first.listingId,
                  );
                  const date = listing?.pickupDate ?? null;
                  const isDelivery = first.fulfillmentMode === "delivery";
                  return (
                    <div key={cookId} className={styles.pickupCard}>
                      <div
                        className={styles.pickupAvatar}
                        style={{ background: first.cookGradient }}
                      >
                        {first.cookInitials}
                      </div>
                      <div>
                        <div className={styles.pickupCook}>
                          {first.cookName}
                        </div>
                        <div className={styles.pickupListing}>
                          {first.listingTitle}
                        </div>
                        <div className={styles.pickupMeta}>
                          {isDelivery ? "Delivery" : "Pickup"}
                          {date ? ` · ${date}` : ""}
                        </div>
                        <div className={styles.pickupMetaSub}>
                          Exact time confirmed after order
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>

              <button
                type="button"
                className={styles.primaryBtn}
                disabled={needsDeliveryAddress && editingAddress}
                onClick={() => {
                  if (validateDetails()) setStep("payment");
                }}
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </>
          )}

          {/* ── Step 2: Payment ── */}
          {step === "payment" && (
            <>
              <section className={styles.formSection}>
                <h2 className={styles.formTitle}>Payment</h2>

                {loadingCards ? (
                  <p className={styles.loadingCards}>
                    Loading payment methods…
                  </p>
                ) : (
                  <div className={styles.walletList}>
                    {/* Saved cards */}
                    {savedCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`${styles.walletRow} ${selectedCardId === card.id ? styles.walletRowActive : ""}`}
                        onClick={() => setSelectedCardId(card.id)}
                      >
                        <span className={styles.walletRadio}>
                          {selectedCardId === card.id && (
                            <span className={styles.walletRadioDot} />
                          )}
                        </span>
                        <span className={styles.walletCardBrand}>
                          {cardBrandLabel(card.brand)}
                        </span>
                        <span className={styles.walletCardNum}>
                          •••• {card.last4}
                        </span>
                        <span className={styles.walletCardExp}>
                          {card.expMonth?.toString().padStart(2, "0")}/
                          {card.expYear?.toString().slice(-2)}
                        </span>
                      </button>
                    ))}

                    {/* Add a new card option */}
                    <button
                      type="button"
                      className={`${styles.walletRow} ${styles.walletRowAdd} ${selectedCardId === "new" ? styles.walletRowActive : ""}`}
                      onClick={() => setSelectedCardId("new")}
                    >
                      <span className={styles.walletRadio}>
                        {selectedCardId === "new" && (
                          <span className={styles.walletRadioDot} />
                        )}
                      </span>
                      <CreditCard size={15} className={styles.walletAddIcon} />
                      <span className={styles.walletAddLabel}>
                        Add a new card
                      </span>
                    </button>

                    {/* New card form — expands inline when "Add a new card" is selected */}
                    {selectedCardId === "new" && (
                      <div className={styles.newCardForm}>
                        <div className={styles.formGroup}>
                          <label className={styles.label} htmlFor="card">
                            Card number
                          </label>
                          <input
                            id="card"
                            type="text"
                            placeholder="1234 5678 9012 3456"
                            className={styles.input}
                            value={rawCard.number}
                            onChange={(e) =>
                              setRawCard((c) => ({
                                ...c,
                                number: e.target.value,
                              }))
                            }
                            maxLength={19}
                            autoComplete="cc-number"
                          />
                          {errors.card && (
                            <p className={styles.fieldError}>{errors.card}</p>
                          )}
                        </div>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="expiry">
                              Expiry
                            </label>
                            <input
                              id="expiry"
                              type="text"
                              placeholder="MM / YY"
                              className={styles.input}
                              value={rawCard.expiry}
                              onChange={(e) =>
                                setRawCard((c) => ({
                                  ...c,
                                  expiry: e.target.value,
                                }))
                              }
                              maxLength={7}
                              autoComplete="cc-exp"
                            />
                            {errors.expiry && (
                              <p className={styles.fieldError}>
                                {errors.expiry}
                              </p>
                            )}
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="cvv">
                              CVV
                            </label>
                            <input
                              id="cvv"
                              type="text"
                              placeholder="•••"
                              className={styles.input}
                              value={rawCard.cvv}
                              onChange={(e) =>
                                setRawCard((c) => ({
                                  ...c,
                                  cvv: e.target.value,
                                }))
                              }
                              maxLength={4}
                              autoComplete="cc-csc"
                            />
                            {errors.cvv && (
                              <p className={styles.fieldError}>{errors.cvv}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Subscription consent — one per subscription listing */}
              {isSubscriptionCart && subscriptionListingIds.length > 0 && (
                <section className={styles.formSection}>
                  <h2 className={styles.formTitle}>
                    Recurring charge authorization
                  </h2>
                  <p className={styles.sectionLead}>
                    Your cart contains subscription items. By checking the boxes
                    below, you authorize recurring charges until you cancel. You
                    can cancel any time from your account settings.
                  </p>
                  {subscriptionListingIds.map((listingId) => {
                    const listing = items.find(
                      (i) => i.listingId === listingId,
                    );
                    if (!listing) return null;
                    const listingTotal = items
                      .filter((i) => i.listingId === listingId)
                      .reduce((s, i) => s + i.price * i.quantity, 0);
                    return (
                      <label
                        key={listingId}
                        className={`${styles.consentBox} ${!subscriptionConsent[listingId] ? styles.consentBoxUnchecked : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={subscriptionConsent[listingId] ?? false}
                          onChange={(e) =>
                            setSubscriptionConsent((prev) => ({
                              ...prev,
                              [listingId]: e.target.checked,
                            }))
                          }
                          className={styles.consentCheckbox}
                        />
                        <span className={styles.consentText}>
                          I authorize 7eats to charge my card{" "}
                          <strong>
                            $
                            {formatCartMoney(
                              calcOntarioHst(listingTotal) + listingTotal,
                            )}{" "}
                            every week
                          </strong>{" "}
                          for <strong>{listing.listingTitle}</strong> until I
                          unsubscribe. {WEEKLY_CHARGE_DISCLAIMER}
                        </span>
                      </label>
                    );
                  })}
                </section>
              )}

              {placeError && <p className={styles.placeError}>{placeError}</p>}

              <div className={styles.stepActions}>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setStep("details")}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className={styles.placeOrderBtn}
                  onClick={handlePlaceOrder}
                  disabled={
                    placing ||
                    !hasValidCard ||
                    (isSubscriptionCart && !allConsentGiven)
                  }
                >
                  {placeCTACopy}
                </button>
              </div>
            </>
          )}
        </div>

        <OrderSummary
          items={items}
          total={total}
          tax={tax}
          grandTotal={grandTotal}
          cartMode={cartMode}
        />
      </div>
    </div>
  );
}

// ─── Order summary sidebar ─────────────────────────────────────────────────────

function OrderSummary({
  items,
  total,
  tax,
  grandTotal,
  cartMode,
}: {
  items: CartItem[];
  total: number;
  tax: number;
  grandTotal: number;
  cartMode: "one-time" | "subscription" | "mixed";
}) {
  const byListing = items.reduce<Record<string, CartItem[]>>((acc, item) => {
    if (!acc[item.listingId]) acc[item.listingId] = [];
    acc[item.listingId].push(item);
    return acc;
  }, {});

  return (
    <aside className={styles.summary}>
      <p className={styles.summaryEyebrow}>Checkout</p>
      <h2 className={styles.summaryTitle}>Order summary</h2>

      <div className={styles.summaryLines}>
        {Object.entries(byListing).map(([listingId, lines]) => {
          const first = lines[0];
          return (
            <div key={listingId} className={styles.summaryGroup}>
              <div className={styles.summaryGroupHead}>
                <span className={styles.summaryGroupTitle}>
                  {first.listingTitle}
                </span>
                <span className={styles.summaryGroupCook}>
                  {first.cookName}
                </span>
                {first.orderType === "subscription" && (
                  <span className={styles.subscriptionBadge}>
                    <RefreshCw size={10} />
                    Weekly
                  </span>
                )}
              </div>
              <ul className={styles.summaryGroupList}>
                {lines.map((item) => (
                  <li key={item.dishId} className={styles.summaryLine}>
                    <span className={styles.summaryLineName}>
                      {item.quantity}× {item.dishName}
                    </span>
                    <span className={styles.summaryLinePrice}>
                      ${formatCartMoney(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className={styles.summarySheet}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryRowLabel}>Subtotal</span>
          <span className={styles.summaryRowVal}>
            ${formatCartMoney(total)}
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryRowLabel}>
            {ONTARIO_HST_LABEL}
            <span className={styles.taxNote}>Ontario</span>
          </span>
          <span className={styles.summaryRowVal}>${formatCartMoney(tax)}</span>
        </div>
      </div>

      <div className={styles.summaryTotal}>
        <span>Total{cartMode !== "one-time" ? " today" : ""}</span>
        <span>${formatCartMoney(grandTotal)}</span>
      </div>

      {cartMode !== "one-time" && (
        <p className={styles.recurringNote}>
          ⟳ Subscription items charge your card{" "}
          <strong>every week automatically</strong>. Cancel any time in Account
          → Subscriptions.
        </p>
      )}

      <p className={styles.terms}>
        Payment held securely until fulfillment is confirmed.
      </p>
    </aside>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
