"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
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
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useGuestAddress } from "@/lib/hooks/use-guest-address";
import {
  INTERVAL_LABELS,
  INTERVAL_RECURRENCE_PHRASES,
  type SubscriptionInterval,
} from "@/lib/subscription-schedule";
import type { NormalizedAddress } from "@/lib/types/address";
import { useApp } from "../_app-context";
import { type CartItem, useCart } from "../_cart-context";
import { getChargeDisclaimer } from "../_subscription-utils";
import { calcTax, formatCartMoney, getTaxLabel } from "../cart/_cart-tax";
import { NewCardForm } from "./_payment-form";
import styles from "./page.module.css";

// ─── Stripe singleton ─────────────────────────────────────────────────────────

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckoutStep = "details" | "payment";

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
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

const EMPTY_ADDRESS: Partial<NormalizedAddress> = {
  province: "ON",
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
  const { isLoggedIn, province } = useApp();
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
  const [address, setAddress] =
    useState<Partial<NormalizedAddress>>(EMPTY_ADDRESS);
  const [editingAddress, setEditingAddress] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [guestCheckoutDone, setGuestCheckoutDone] = useState(false);
  const [guestCheckoutEmail, setGuestCheckoutEmail] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [guestAgreed, setGuestAgreed] = useState(false);
  const { guestAddress } = useGuestAddress();

  // Payment method selection
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | "new">("new");

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

  // Fetch saved cards when logged-in user reaches payment step.
  useEffect(() => {
    if ((!isLoggedIn && !guestCheckoutDone) || step !== "payment") return;
    setLoadingCards(true);
    fetch("/api/checkout/payment-methods")
      .then((r) => r.json())
      .then((data: { data?: SavedCard[] }) => {
        const cards = data.data ?? [];
        if (cards.length > 0) {
          setSavedCards(cards);
          setSelectedCardId(cards[0].id);
        } else {
          setSavedCards([]);
          setSelectedCardId("new");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCards(false));
  }, [isLoggedIn, guestCheckoutDone, step]);

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
    // Pre-fill delivery address from the user's saved address book entry, if any
    fetch("/api/user/address")
      .then((r) => r.json())
      .then((data: { address?: NormalizedAddress | null }) => {
        if (data.address) setAddress(data.address);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn || !guestAddress) return;
    setAddress({
      street: guestAddress.street || "",
      unit: guestAddress.unit || "",
      city: guestAddress.city || "",
      province: guestAddress.province || "ON",
      postal: guestAddress.postal || "",
    });
  }, [isLoggedIn, guestAddress]);

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
    const taxAmount = calcTax(total, province);
    return {
      tax: taxAmount,
      grandTotal: Math.round((total + taxAmount) * 100) / 100,
    };
  }, [total, province]);

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
    const e: Record<string, string> = {};

    if (isLoggedIn || guestCheckoutDone) {
      if (needsDeliveryAddress && !editingAddress) {
        if (!address.street?.trim()) e.street = "Required";
        if (!address.city?.trim()) e.city = "Required";
        if (!address.province?.trim()) e.province = "Required";
        if (!address.postal?.trim()) e.postal = "Required";
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    }

    if (isSubscriptionCart) {
      return false;
    }

    if (!guestFirstName.trim()) e.guestFirstName = "Required";
    if (!guestLastName.trim()) e.guestLastName = "Required";
    if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))
      e.guestEmail = "Valid email required";
    if (!guestPhone.trim() || guestPhone.replace(/\D/g, "").length < 7)
      e.guestPhone = "Valid phone required";
    if (!guestAgreed) e.guestConsent = "Please agree to the terms to continue.";
    if (needsDeliveryAddress) {
      if (!address.street?.trim()) e.street = "Required";
      if (!address.city?.trim()) e.city = "Required";
      if (!address.province?.trim()) e.province = "Required";
      if (!address.postal?.trim()) e.postal = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Guest checkout ─────────────────────────────────────────────────────────

  async function handleGuestCheckout(): Promise<boolean> {
    setGuestSubmitting(true);
    setGuestError("");

    try {
      if (
        needsDeliveryAddress &&
        guestAddress?.lat != null &&
        guestAddress?.lng != null
      ) {
        const deliveryItems = items.filter(
          (i) => i.fulfillmentMode === "delivery",
        );
        const uniqueListingIds = [
          ...new Set(deliveryItems.map((i) => i.listingId)),
        ];

        for (const listingId of uniqueListingIds) {
          const checkRes = await fetch(
            `/api/service-area?lat=${guestAddress.lat}&lng=${guestAddress.lng}&listingId=${encodeURIComponent(listingId)}`,
          );
          const checkJson = (await checkRes.json()) as {
            data?: { inRange: boolean; distanceKm: number | null };
            error?: string;
          };
          if (checkRes.ok && checkJson.data && !checkJson.data.inRange) {
            const cookItem = items.find((i) => i.listingId === listingId);
            setGuestError(
              `Your address is outside ${cookItem?.cookName ?? "this cook"}'s delivery area (${checkJson.data.distanceKm ?? "?"} km away). Try pickup instead.`,
            );
            return false;
          }
        }
      }

      const res = await fetch("/api/auth/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: guestFirstName.trim(),
          lastName: guestLastName.trim(),
          email: guestEmail.trim().toLowerCase(),
          phone: guestPhone.trim(),
          acceptedTerms: true,
        }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        needsLogin?: boolean;
        email?: string;
        error?: string;
      };

      if (!res.ok) {
        setGuestError(
          json.error ?? "Could not complete guest checkout. Please try again.",
        );
        return false;
      }

      if (json.needsLogin) {
        router.push(
          `/app-auth/login?next=${encodeURIComponent("/app/checkout?step=payment")}&email=${encodeURIComponent(json.email ?? "")}`,
        );
        return false;
      }

      setGuestCheckoutDone(true);
      setGuestCheckoutEmail(json.email ?? guestEmail);
      return true;
    } catch {
      setGuestError("Something went wrong. Please try again.");
      return false;
    } finally {
      setGuestSubmitting(false);
    }
  }

  // ── Place order with a real paymentMethodId ────────────────────────────────

  async function placeOrdersWithPaymentMethod(paymentMethodId: string) {
    if (!allConsentGiven && isSubscriptionCart) {
      setPlaceError(
        "Please confirm your subscription authorization above before placing your order.",
      );
      return;
    }

    setPlacing(true);
    setPlaceError("");

    // One order (or subscription) per cook group — collect results for the
    // confirmation page
    const cookGroups = Object.entries(grouped);
    const orderEntries: Array<{
      orderId: string;
      cookName: string;
      fulfillmentMode: "pickup" | "delivery";
      hasSubscription: boolean;
      subscriptionInterval?: SubscriptionInterval;
    }> = [];

    try {
      for (const [, cookItems] of cookGroups) {
        // Group by listing within this cook's items
        const byListing = cookItems.reduce<Record<string, typeof items>>(
          (acc, item) => {
            if (!acc[item.listingId]) acc[item.listingId] = [];
            acc[item.listingId].push(item);
            return acc;
          },
          {},
        );

        for (const [listingId, listingItems] of Object.entries(byListing)) {
          const first = listingItems[0];

          if (first.orderType === "subscription" && first.tierId) {
            const res = await fetch("/api/subscriptions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                listingId,
                tierId: first.tierId,
                paymentMethodId,
              }),
            });

            const json = await res.json();

            if (!res.ok) {
              throw new Error(
                (json as { error?: string }).error ??
                  "Subscription creation failed.",
              );
            }

            const subscriptionId = (json as { data: { id: string } }).data.id;

            orderEntries.push({
              orderId: subscriptionId,
              cookName: first.cookName,
              fulfillmentMode: first.fulfillmentMode,
              hasSubscription: true,
              subscriptionInterval: first.subscriptionInterval,
            });
            continue;
          }

          const quantity = listingItems.reduce((sum, i) => sum + i.quantity, 0);

          const body: Record<string, unknown> = {
            listingId,
            quantity,
            paymentMethodId,
            fulfillmentMode: first.fulfillmentMode,
          };

          if (needsDeliveryAddress && first.fulfillmentMode === "delivery") {
            body.deliveryAddress = {
              street: address.street ?? "",
              unit: address.unit || undefined,
              city: address.city ?? "",
              province: address.province ?? "",
              postal: address.postal ?? "",
            };
            if (address.lat != null && address.lng != null) {
              body.customerLat = address.lat;
              body.customerLng = address.lng;
            }
          }

          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const json = await res.json();

          if (!res.ok) {
            throw new Error(
              (json as { error?: string }).error ?? "Order creation failed.",
            );
          }

          const orderId = (json as { data: { orderId: string } }).data.orderId;

          orderEntries.push({
            orderId,
            cookName: first.cookName,
            fulfillmentMode: first.fulfillmentMode,
            hasSubscription: false,
          });
        }
      }

      setOrdered(true);
      clearCart();

      // Encode orders for confirmation page: index-keyed params
      const params = new URLSearchParams();
      orderEntries.forEach((o, i) => {
        params.set(`oid${i}`, o.orderId);
        params.set(`cook${i}`, o.cookName);
        params.set(`mode${i}`, o.fulfillmentMode);
        if (o.hasSubscription) {
          params.set(`sub${i}`, "1");
          if (o.subscriptionInterval) {
            params.set(`subint${i}`, o.subscriptionInterval);
          }
        }
      });
      params.set("count", String(orderEntries.length));
      if (!isLoggedIn && guestCheckoutDone && guestCheckoutEmail) {
        params.set("guest", "1");
        params.set("email", guestCheckoutEmail);
      }
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

  // ── Saved-card submit ──────────────────────────────────────────────────────

  async function handleSavedCardSubmit() {
    if (isSubscriptionCart && !allConsentGiven) {
      setPlaceError(
        "Please confirm your subscription authorization above before placing your order.",
      );
      return;
    }
    await placeOrdersWithPaymentMethod(selectedCardId);
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

                {isLoggedIn || guestCheckoutDone ? (
                  <div className={styles.contactSummary}>
                    <div className={styles.contactRow}>
                      <span className={styles.contactLabel}>Name</span>
                      <span className={styles.contactValue}>
                        {contact.firstName || guestFirstName}{" "}
                        {contact.lastName || guestLastName}
                      </span>
                    </div>
                    <div className={styles.contactRow}>
                      <span className={styles.contactLabel}>Email</span>
                      <span className={styles.contactValue}>
                        {contact.email || guestCheckoutEmail}
                      </span>
                    </div>
                    {(contact.phone || guestPhone) && (
                      <div className={styles.contactRow}>
                        <span className={styles.contactLabel}>Phone</span>
                        <span className={styles.contactValue}>
                          {contact.phone || guestPhone}
                        </span>
                      </div>
                    )}
                  </div>
                ) : isSubscriptionCart ? (
                  <div className={styles.guestBlock}>
                    <p className={styles.guestBlockMsg}>
                      Subscription orders require an account.{" "}
                      <a
                        href={`/app-auth/login?next=${encodeURIComponent("/app/checkout?step=payment")}`}
                        className={styles.guestBlockLink}
                      >
                        Sign in
                      </a>{" "}
                      or{" "}
                      <a
                        href="/app-auth/signup"
                        className={styles.guestBlockLink}
                      >
                        create one
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label
                          className={styles.label}
                          htmlFor="guestFirstName"
                        >
                          First name
                        </label>
                        <input
                          id="guestFirstName"
                          type="text"
                          className={styles.input}
                          value={guestFirstName}
                          onChange={(e) => {
                            setGuestFirstName(e.target.value);
                            setGuestError("");
                          }}
                          autoComplete="given-name"
                        />
                        {errors.guestFirstName && (
                          <p className={styles.fieldError}>
                            {errors.guestFirstName}
                          </p>
                        )}
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="guestLastName">
                          Last name
                        </label>
                        <input
                          id="guestLastName"
                          type="text"
                          className={styles.input}
                          value={guestLastName}
                          onChange={(e) => {
                            setGuestLastName(e.target.value);
                            setGuestError("");
                          }}
                          autoComplete="family-name"
                        />
                        {errors.guestLastName && (
                          <p className={styles.fieldError}>
                            {errors.guestLastName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="guestEmail">
                        Email
                      </label>
                      <input
                        id="guestEmail"
                        type="email"
                        className={styles.input}
                        value={guestEmail}
                        onChange={(e) => {
                          setGuestEmail(e.target.value);
                          setGuestError("");
                        }}
                        autoComplete="email"
                      />
                      {errors.guestEmail && (
                        <p className={styles.fieldError}>{errors.guestEmail}</p>
                      )}
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="guestPhone">
                        Phone number
                      </label>
                      <input
                        id="guestPhone"
                        type="tel"
                        className={styles.input}
                        value={guestPhone}
                        onChange={(e) => {
                          setGuestPhone(e.target.value);
                          setGuestError("");
                        }}
                        autoComplete="tel"
                      />
                      {errors.guestPhone && (
                        <p className={styles.fieldError}>{errors.guestPhone}</p>
                      )}
                    </div>
                    <label className={styles.consentBox}>
                      <input
                        type="checkbox"
                        checked={guestAgreed}
                        onChange={(e) => {
                          setGuestAgreed(e.target.checked);
                          if (e.target.checked)
                            setErrors((prev) => ({
                              ...prev,
                              guestConsent: "",
                            }));
                        }}
                        className={styles.consentCheckbox}
                      />
                      <span className={styles.consentText}>
                        I agree to the{" "}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Terms of Service
                        </a>
                        ,{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Privacy Policy
                        </a>
                        , and{" "}
                        <a
                          href="/refund-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Refund Policy
                        </a>
                        .
                      </span>
                    </label>
                    {errors.guestConsent && (
                      <p className={styles.fieldError}>{errors.guestConsent}</p>
                    )}
                    {guestError && (
                      <p className={styles.placeError} role="alert">
                        {guestError}
                      </p>
                    )}
                    <p className={styles.guestNote}>
                      Already have an account?{" "}
                      <a
                        href={`/app-auth/login?next=${encodeURIComponent("/app/checkout?step=payment")}`}
                        className={styles.guestBlockLink}
                      >
                        Sign in
                      </a>
                    </p>
                  </>
                )}
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
                      <AddressAutocomplete
                        value={address}
                        onChange={setAddress}
                        errors={{
                          street: errors.street,
                          city: errors.city,
                          province: errors.province,
                          postal: errors.postal,
                        }}
                        idPrefix="checkout-address"
                        inputClassName={styles.input}
                      />
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
                disabled={
                  (needsDeliveryAddress && editingAddress) || guestSubmitting
                }
                onClick={async () => {
                  if (!validateDetails()) return;
                  if (!isLoggedIn && !guestCheckoutDone) {
                    const ok = await handleGuestCheckout();
                    if (!ok) return;
                  }
                  setStep("payment");
                }}
              >
                {guestSubmitting ? "Setting up…" : "Continue"}
                {!guestSubmitting && <ArrowRight size={16} />}
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

                    {/* New card form — Stripe CardElement when "Add a new card" is selected */}
                    {selectedCardId === "new" && (
                      <div className={styles.newCardForm}>
                        <Elements stripe={stripePromise}>
                          <NewCardForm
                            onTokenized={placeOrdersWithPaymentMethod}
                            loading={placing}
                          />
                        </Elements>
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
                    if (!listing?.subscriptionInterval) return null;
                    const interval = listing.subscriptionInterval;
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
                              calcTax(listingTotal, province) + listingTotal,
                            )}{" "}
                            {INTERVAL_RECURRENCE_PHRASES[interval]}
                          </strong>{" "}
                          for <strong>{listing.listingTitle}</strong> until I
                          unsubscribe. {getChargeDisclaimer(interval)}
                        </span>
                      </label>
                    );
                  })}
                </section>
              )}

              {placeError && (
                <p className={styles.placeError} role="alert">
                  {placeError}
                </p>
              )}

              <div className={styles.stepActions}>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => {
                    setStep("details");
                    setPlaceError("");
                  }}
                >
                  ← Back
                </button>

                {/* Saved card — submit directly */}
                {selectedCardId !== "new" && (
                  <button
                    type="button"
                    className={styles.placeOrderBtn}
                    onClick={handleSavedCardSubmit}
                    disabled={
                      placing || (isSubscriptionCart && !allConsentGiven)
                    }
                  >
                    {placeCTACopy}
                  </button>
                )}
                {/* New card — form submit is handled inside NewCardForm */}
                {selectedCardId === "new" && (
                  <p className={styles.loadingCards}>
                    Complete the card details above to place your order.
                  </p>
                )}
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
          taxLabel={getTaxLabel(province)}
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
  taxLabel,
}: {
  items: CartItem[];
  total: number;
  tax: number;
  grandTotal: number;
  cartMode: "one-time" | "subscription" | "mixed";
  taxLabel: string;
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
                {first.orderType === "subscription" &&
                  first.subscriptionInterval && (
                    <span className={styles.subscriptionBadge}>
                      <RefreshCw size={10} />
                      {INTERVAL_LABELS[first.subscriptionInterval]}
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
          <span className={styles.summaryRowLabel}>{taxLabel}</span>
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
