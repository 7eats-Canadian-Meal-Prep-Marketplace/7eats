"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedAddress } from "@/components/AddressSearchInput";
import { AddressSearchInput } from "@/components/AddressSearchInput";
import {
  type FulfillmentWindow,
  nextFulfillmentSlotIso,
} from "@/lib/cook-card-schedule";
import { useGuestAddress } from "@/lib/hooks/use-guest-address";
import { SPECIAL_REQUESTS_DISCLAIMER } from "@/lib/orders/special-requests-copy";
import {
  formatPhoneDisplay,
  isValidNorthAmericanPhone,
  phoneDigits,
} from "@/lib/phone";
import { refundPolicyText } from "@/lib/refund-policy";
import type { NormalizedAddress } from "@/lib/types/address";
import { useApp } from "../_app-context";
import { type DeliveryAddress, useCart } from "../_cart-context";
import { useServiceAddress } from "../_service-address-context";
import { calcTax, formatCartMoney, getTaxLabel } from "../cart/_cart-tax";
import {
  type CheckoutPaymentHandle,
  CheckoutPaymentSection,
} from "./_checkout-payment";
import styles from "./page.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactField = "firstName" | "lastName" | "email" | "phone";
type ContactErrors = Partial<Record<ContactField, string>>;

function contactFieldError(
  field: ContactField,
  values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  },
): string | undefined {
  switch (field) {
    case "firstName":
      return values.firstName.trim() ? undefined : "First name is required.";
    case "lastName":
      return values.lastName.trim() ? undefined : "Last name is required.";
    case "email": {
      const trimmed = values.email.trim();
      if (!trimmed) return "Email is required.";
      if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address.";
      return undefined;
    }
    case "phone": {
      if (!values.phone) return "Phone number is required.";
      if (!isValidNorthAmericanPhone(values.phone)) {
        return "Enter a valid 10-digit phone number.";
      }
      return undefined;
    }
  }
}

function validateGuestContactFields(values: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of [
    "firstName",
    "lastName",
    "email",
    "phone",
  ] as ContactField[]) {
    const message = contactFieldError(field, values);
    if (message) errors[field] = message;
  }
  return errors;
}

function formatAddressLine(addr: NormalizedAddress): string {
  const unit = addr.unit ? `${addr.unit}, ` : "";
  return `${unit}${addr.street}, ${addr.city}, ${addr.province} ${addr.postal}`;
}

function toDeliveryAddress(addr: NormalizedAddress): DeliveryAddress {
  return {
    street: addr.street,
    unit: addr.unit,
    city: addr.city,
    province: addr.province,
    postal: addr.postal,
    lat: addr.lat,
    lng: addr.lng,
  };
}

function resolvedToNormalized(resolved: ResolvedAddress): NormalizedAddress {
  return {
    street: resolved.streetAddress,
    city: resolved.city,
    province: resolved.province,
    postal: resolved.postalCode,
    lat: resolved.lat,
    lng: resolved.lng,
    placeId: resolved.placeId,
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { isLoggedIn, userName, userEmail, setProvince } = useApp();
  const {
    currentAddress,
    ready: addressReady,
    setServerAddress,
  } = useServiceAddress();
  const { addAddress } = useGuestAddress();
  const paymentRef = useRef<CheckoutPaymentHandle>(null);

  const {
    cookId,
    cookName,
    cookProvince,
    items,
    subtotal,
    totalQuantity,
    meetsMinimum,
    fulfillmentMode,
    deliveryAddress,
    notes,
    cancellationAllowed,
    leadTime,
    setDeliveryAddress,
    setNotes,
    clearCart,
  } = useCart();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreedPolicy, setAgreedPolicy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState<{ email: string } | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryOutOfRange, setDeliveryOutOfRange] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [pendingAddress, setPendingAddress] =
    useState<NormalizedAddress | null>(null);
  const [noteDraft, setNoteDraft] = useState(notes ?? "");
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [pickupWindows, setPickupWindows] = useState<FulfillmentWindow[]>([]);
  const [deliveryWindows, setDeliveryWindows] = useState<FulfillmentWindow[]>(
    [],
  );
  const [acceptsSpecialRequests, setAcceptsSpecialRequests] = useState<
    boolean | null
  >(null);
  const [pendingPayment, setPendingPayment] = useState<{
    orderId: string;
    clientSecret: string;
    guestAccessToken?: string;
  } | null>(null);

  const isDelivery = fulfillmentMode === "delivery";
  const displayAddress = pendingAddress ?? currentAddress;

  useEffect(() => {
    if (items.length === 0 && !placing && !ordered) router.replace("/app/cart");
  }, [items.length, placing, ordered, router]);

  useEffect(() => {
    setNoteDraft(notes ?? "");
  }, [notes]);

  useEffect(() => {
    if (!cookId) return;
    let cancelled = false;
    fetch(`/api/cooks/${cookId}/menu`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.data?.cook) return;
        const cook = json.data.cook;
        setPickupWindows(cook.pickupWindows ?? []);
        setDeliveryWindows(cook.deliveryWindows ?? []);
        setAcceptsSpecialRequests(Boolean(cook.acceptsSpecialRequests));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cookId]);

  useEffect(() => {
    if (!isDelivery || !displayAddress) return;
    setDeliveryAddress(toDeliveryAddress(displayAddress));
    setProvince(displayAddress.province);
  }, [isDelivery, displayAddress, setDeliveryAddress, setProvince]);

  useEffect(() => {
    if (
      !isDelivery ||
      !cookId ||
      !displayAddress?.lat ||
      !displayAddress?.lng
    ) {
      setDeliveryFee(0);
      setDeliveryOutOfRange(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/delivery/distance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cookId,
            customerLat: displayAddress.lat,
            customerLng: displayAddress.lng,
            orderSubtotal: subtotal,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setDeliveryOutOfRange(Boolean(data.isOutOfRange));
          setDeliveryFee(
            data.isOutOfRange || data.isFree ? 0 : (data.fee ?? 0),
          );
        }
      } catch {
        /* non-fatal — server snapshots authoritative fee */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDelivery, cookId, subtotal, displayAddress?.lat, displayAddress?.lng]);

  const { tax, grandTotal, taxLabel } = useMemo(() => {
    const taxAmount =
      Math.round(calcTax(subtotal + deliveryFee, cookProvince) * 100) / 100;
    return {
      tax: taxAmount,
      grandTotal: Math.round((subtotal + deliveryFee + taxAmount) * 100) / 100,
      taxLabel: getTaxLabel(cookProvince),
    };
  }, [subtotal, deliveryFee, cookProvince]);

  const refundPickupAt = useMemo(
    () =>
      nextFulfillmentSlotIso(
        fulfillmentMode,
        pickupWindows,
        deliveryWindows,
        leadTime,
      ),
    [fulfillmentMode, pickupWindows, deliveryWindows, leadTime],
  );

  const cancellationPolicyText = useMemo(
    () => refundPolicyText(cancellationAllowed, refundPickupAt, leadTime),
    [cancellationAllowed, refundPickupAt, leadTime],
  );

  const contactValues = useMemo(
    () => ({ firstName, lastName, email, phone }),
    [firstName, lastName, email, phone],
  );

  function touchContactField(field: ContactField) {
    const message = contactFieldError(field, contactValues);
    setContactErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function updateContactField(
    field: ContactField,
    value: string,
    setter: (v: string) => void,
  ) {
    setter(value);
    if (contactErrors[field]) {
      const message = contactFieldError(field, {
        ...contactValues,
        [field]: value,
      });
      setContactErrors((prev) => {
        const next = { ...prev };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    }
  }

  const handleAddressResolve = useCallback(
    async (resolved: ResolvedAddress) => {
      const normalized = resolvedToNormalized(resolved);
      setPendingAddress(normalized);
      setAddressInput(resolved.streetAddress);
      setDeliveryAddress(toDeliveryAddress(normalized));
      setProvince(normalized.province);

      if (isLoggedIn) {
        try {
          const res = await fetch("/api/user/address", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              street: normalized.street,
              unit: normalized.unit ?? null,
              city: normalized.city,
              province: normalized.province,
              postal: normalized.postal,
              lat: normalized.lat,
              lng: normalized.lng,
              placeId: normalized.placeId,
            }),
          });
          if (res.ok) setServerAddress(normalized);
        } catch {
          /* keep pending local state */
        }
      } else {
        addAddress({
          street: normalized.street,
          unit: normalized.unit ?? "",
          city: normalized.city,
          province: normalized.province,
          postal: normalized.postal,
          lat: normalized.lat,
          lng: normalized.lng,
          placeId: normalized.placeId,
        });
      }
      setEditingAddress(false);
    },
    [addAddress, isLoggedIn, setDeliveryAddress, setProvince, setServerAddress],
  );

  function startAddressEdit() {
    setEditingAddress(true);
    setAddressInput(displayAddress?.street ?? "");
    setPendingAddress(null);
  }

  function validateGuestContact(): string | null {
    const errors = validateGuestContactFields(contactValues);
    setContactErrors(errors);
    const first = Object.values(errors)[0];
    return first ?? null;
  }

  async function placeOrder() {
    if (!cookId) return;

    setError(null);
    setNeedsLogin(null);

    if (!meetsMinimum) {
      setError(
        "Your cart no longer meets the minimum order. Please return to the menu.",
      );
      return;
    }

    if (!agreedPolicy) {
      setError(
        "Please confirm you understand this cook's cancellation policy.",
      );
      return;
    }

    if (isDelivery && !displayAddress) {
      setError("Add a delivery address to continue.");
      return;
    }

    if (isDelivery && deliveryOutOfRange) {
      setError(
        `${cookName ?? "This kitchen"} doesn't deliver to this address. Choose a closer address or switch to pickup.`,
      );
      return;
    }

    if (!isLoggedIn) {
      const contactErr = validateGuestContact();
      if (contactErr) {
        setError(contactErr);
        return;
      }
    }

    if (!pendingPayment) {
      setPlacing(true);
      try {
        if (notes !== noteDraft) setNotes(noteDraft.trim() || null);

        const orderPayload = {
          cookId,
          dishes: items.map((i) => ({
            dishId: i.dishId,
            quantity: i.quantity,
            promotionId: i.promotionId,
          })),
          fulfillmentMode,
          deliveryAddress: isDelivery ? deliveryAddress : undefined,
          customerLat: isDelivery ? displayAddress?.lat : undefined,
          customerLng: isDelivery ? displayAddress?.lng : undefined,
          notes: (noteDraft.trim() || notes) ?? undefined,
        };

        if (!isLoggedIn) {
          const guestRes = await fetch("/api/orders/guest", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...orderPayload,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              acceptedTerms: true,
            }),
          });
          const guestData = await guestRes.json();
          if (guestData.needsLogin) {
            setNeedsLogin({ email: guestData.email ?? email.trim() });
            return;
          }
          if (!guestRes.ok) {
            setError(guestData.error ?? "Could not place your order.");
            return;
          }

          setPendingPayment({
            orderId: guestData.data.orderId,
            clientSecret: guestData.data.clientSecret,
            guestAccessToken: guestData.data.accessToken,
          });
          setPaymentReady(false);
          return;
        }

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(orderPayload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not place your order.");
          return;
        }

        setPendingPayment({
          orderId: data.data.orderId,
          clientSecret: data.data.clientSecret,
        });
        setPaymentReady(false);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setPlacing(false);
      }
      return;
    }

    setPlacing(true);
    try {
      const payResult = await paymentRef.current?.confirmPayment();
      if (!payResult?.ok) {
        setError(payResult?.error ?? "Payment failed. Please try again.");
        return;
      }

      const confirmRes = await fetch(
        `/api/orders/${pendingPayment.orderId}/confirm-payment`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            pendingPayment.guestAccessToken
              ? { guestAccessToken: pendingPayment.guestAccessToken }
              : {},
          ),
        },
      );
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        setError(confirmData.error ?? "Could not confirm your payment.");
        return;
      }

      setOrdered(true);
      clearCart();

      if (pendingPayment.guestAccessToken) {
        router.push(
          `/app/checkout/guest-confirmation?token=${encodeURIComponent(pendingPayment.guestAccessToken)}`,
        );
        return;
      }

      const params = new URLSearchParams({
        count: "1",
        oid0: pendingPayment.orderId,
        cook0: cookName ?? "Your cook",
        mode0: fulfillmentMode,
      });
      router.push(`/app/checkout/confirmation?${params.toString()}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0 && !placing && !ordered) return null;

  const fulfillmentLabel = isDelivery ? "delivery" : "pickup";
  const loginHref = needsLogin
    ? `/app-auth/login?email=${encodeURIComponent(needsLogin.email)}`
    : "/app-auth/login";

  return (
    <div className={styles.page}>
      <Link href="/app/cart" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden />
        Back to cart
      </Link>

      <header className={styles.pageHeader}>
        <h1 className={styles.heading}>Checkout</h1>
        <p className={styles.subheading}>
          {cookName ? `Order from ${cookName}` : "Review and pay"}
        </p>
        <p className={styles.reassurance}>
          The cook confirms your exact {fulfillmentLabel} time.
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.formSide}>
          {/* Contact */}
          <section className={styles.formSection}>
            <h2 className={styles.formTitle}>Contact</h2>
            {isLoggedIn ? (
              <p className={styles.orderingAs}>
                Ordering as{" "}
                <strong>{userName || userEmail || "your account"}</strong>
              </p>
            ) : (
              <div className={styles.contactFields}>
                <div className={styles.nameRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="checkout-first">
                      First name
                    </label>
                    <input
                      id="checkout-first"
                      className={
                        contactErrors.firstName
                          ? `${styles.input} ${styles.inputInvalid}`
                          : styles.input
                      }
                      value={firstName}
                      onChange={(e) =>
                        updateContactField(
                          "firstName",
                          e.target.value,
                          setFirstName,
                        )
                      }
                      onBlur={() => touchContactField("firstName")}
                      autoComplete="given-name"
                      required
                      aria-invalid={Boolean(contactErrors.firstName)}
                      aria-describedby={
                        contactErrors.firstName
                          ? "checkout-first-error"
                          : undefined
                      }
                    />
                    {contactErrors.firstName && (
                      <p
                        id="checkout-first-error"
                        className={styles.fieldErrorInline}
                        role="alert"
                      >
                        {contactErrors.firstName}
                      </p>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="checkout-last">
                      Last name
                    </label>
                    <input
                      id="checkout-last"
                      className={
                        contactErrors.lastName
                          ? `${styles.input} ${styles.inputInvalid}`
                          : styles.input
                      }
                      value={lastName}
                      onChange={(e) =>
                        updateContactField(
                          "lastName",
                          e.target.value,
                          setLastName,
                        )
                      }
                      onBlur={() => touchContactField("lastName")}
                      autoComplete="family-name"
                      required
                      aria-invalid={Boolean(contactErrors.lastName)}
                      aria-describedby={
                        contactErrors.lastName
                          ? "checkout-last-error"
                          : undefined
                      }
                    />
                    {contactErrors.lastName && (
                      <p
                        id="checkout-last-error"
                        className={styles.fieldErrorInline}
                        role="alert"
                      >
                        {contactErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="checkout-email">
                    Email
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    inputMode="email"
                    className={
                      contactErrors.email
                        ? `${styles.input} ${styles.inputInvalid}`
                        : styles.input
                    }
                    value={email}
                    onChange={(e) =>
                      updateContactField("email", e.target.value, setEmail)
                    }
                    onBlur={() => touchContactField("email")}
                    autoComplete="email"
                    required
                    aria-invalid={Boolean(contactErrors.email)}
                    aria-describedby={
                      contactErrors.email ? "checkout-email-error" : undefined
                    }
                  />
                  {contactErrors.email && (
                    <p
                      id="checkout-email-error"
                      className={styles.fieldErrorInline}
                      role="alert"
                    >
                      {contactErrors.email}
                    </p>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="checkout-phone">
                    Phone
                  </label>
                  <input
                    id="checkout-phone"
                    type="tel"
                    inputMode="numeric"
                    className={
                      contactErrors.phone
                        ? `${styles.input} ${styles.inputInvalid}`
                        : styles.input
                    }
                    value={formatPhoneDisplay(phone)}
                    onChange={(e) =>
                      updateContactField(
                        "phone",
                        phoneDigits(e.target.value),
                        setPhone,
                      )
                    }
                    onBlur={() => touchContactField("phone")}
                    autoComplete="tel"
                    placeholder="(416) 555-0100"
                    required
                    aria-invalid={Boolean(contactErrors.phone)}
                    aria-describedby={
                      contactErrors.phone ? "checkout-phone-error" : undefined
                    }
                  />
                  {contactErrors.phone && (
                    <p
                      id="checkout-phone-error"
                      className={styles.fieldErrorInline}
                      role="alert"
                    >
                      {contactErrors.phone}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Delivery address */}
          {isDelivery && (
            <section className={styles.formSection}>
              <h2 className={styles.formTitle}>Delivery address</h2>
              {!addressReady ? (
                <p className={styles.sectionLead}>Loading address…</p>
              ) : editingAddress || !displayAddress ? (
                <div className={styles.addressEditBlock}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="checkout-address">
                      Street address
                    </label>
                    <AddressSearchInput
                      id="checkout-address"
                      value={addressInput}
                      onTextChange={setAddressInput}
                      onResolve={handleAddressResolve}
                      className={styles.addressEditInput}
                      placeholder="Start typing your address…"
                    />
                    <p className={styles.addressEditHint}>
                      Choose a complete address from the suggestions.
                    </p>
                  </div>
                  {displayAddress && (
                    <div className={styles.addressEditActions}>
                      <button
                        type="button"
                        className={styles.addressEditCancelBtn}
                        onClick={() => setEditingAddress(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.addressSummary}>
                  <p className={styles.addressLine}>
                    {formatAddressLine(displayAddress)}
                  </p>
                  <button
                    type="button"
                    className={styles.addressEditRow}
                    onClick={startAddressEdit}
                  >
                    Edit address
                  </button>
                </div>
              )}
              {deliveryOutOfRange && (
                <p className={styles.deliveryOutOfRange} role="alert">
                  {cookName ?? "This kitchen"} doesn&apos;t deliver to this
                  address. Choose a closer address, or switch to pickup on the
                  menu.
                </p>
              )}
            </section>
          )}

          <section className={styles.formSection}>
            <h2 className={styles.formTitle}>Note for the cook</h2>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="checkout-note">
                Special request (optional)
              </label>
              <textarea
                id="checkout-note"
                className={styles.textarea}
                rows={3}
                placeholder={
                  acceptsSpecialRequests === false
                    ? "Allergies, dietary restrictions, health-related needs…"
                    : "Allergies, spice level, pickup instructions…"
                }
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              {acceptsSpecialRequests === false && (
                <p className={styles.noteDisclaimer}>
                  {SPECIAL_REQUESTS_DISCLAIMER}
                </p>
              )}
            </div>
          </section>

          {/* Payment — only appears once the order total is locked in and a
              secure payment session exists (after "Continue to payment"), so
              there's no empty placeholder sitting in the flow beforehand. */}
          {pendingPayment && (
            <section className={styles.formSection}>
              <h2 className={styles.formTitle}>Payment</h2>
              <CheckoutPaymentSection
                ref={paymentRef}
                clientSecret={pendingPayment.clientSecret}
                onReadyChange={setPaymentReady}
              />
            </section>
          )}

          {/* Cancellation — below payment */}
          <section className={styles.formSection}>
            <h2 className={styles.formTitle}>Cancellation policy</h2>
            <div className={styles.policyBox}>
              <p className={styles.policyText}>{cancellationPolicyText}</p>
              <label className={styles.policyConsent}>
                <input
                  type="checkbox"
                  className={styles.consentCheckbox}
                  checked={agreedPolicy}
                  onChange={(e) => setAgreedPolicy(e.target.checked)}
                />
                <span className={styles.consentText}>
                  I understand{cookName ? ` ${cookName}'s` : ""} cancellation
                  policy{" "}
                  {cancellationAllowed
                    ? "and refund window."
                    : "and that this sale is final."}
                </span>
              </label>
            </div>

            <div className={styles.submitBlock}>
              {needsLogin && (
                <div className={styles.guestBlock} role="alert">
                  <p className={styles.guestBlockMsg}>
                    An account already exists for this email. Log in to place
                    your order with saved details.
                  </p>
                  <Link href={loginHref} className={styles.guestBlockLink}>
                    Log in as {needsLogin.email}
                  </Link>
                </div>
              )}

              {error && (
                <p className={styles.placeError} role="alert">
                  {error}
                </p>
              )}

              <button
                type="button"
                className={styles.placeOrderBtn}
                disabled={
                  placing ||
                  (pendingPayment ? !paymentReady : false) ||
                  !agreedPolicy ||
                  (isDelivery && deliveryOutOfRange)
                }
                onClick={() => void placeOrder()}
              >
                {placing
                  ? "Processing…"
                  : pendingPayment
                    ? `Pay $${formatCartMoney(grandTotal)}`
                    : "Continue to payment"}
              </button>

              <p className={styles.terms}>
                By placing your order you agree to our{" "}
                <Link href="/terms" className={styles.termsLink}>
                  Terms of Service
                </Link>
                .
              </p>
            </div>
          </section>
        </div>

        {/* Summary rail with items */}
        <aside className={styles.rail}>
          <div className={styles.railInner}>
            <div className={styles.summary}>
              <span className={styles.summaryEyebrow}>Order summary</span>
              <h2 className={styles.summaryTitle}>
                {cookName ?? "Your order"}
              </h2>

              <div className={styles.summaryLines}>
                <ul className={styles.summaryGroupList}>
                  {items.map((item) => (
                    <li key={item.dishId} className={styles.summaryLine}>
                      <span className={styles.summaryLineName}>
                        {item.quantity}× {item.name}
                        {item.discountAmount > 0 && (
                          <span className={styles.discountHint}>
                            {" "}
                            (−${formatCartMoney(item.discountAmount)})
                          </span>
                        )}
                      </span>
                      <span className={styles.summaryLinePrice}>
                        ${formatCartMoney(item.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.summarySheet}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryRowLabel}>
                    Subtotal ({totalQuantity})
                  </span>
                  <span className={styles.summaryRowVal}>
                    ${formatCartMoney(subtotal)}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryRowLabel}>Delivery</span>
                  <span className={styles.summaryRowVal}>
                    {isDelivery
                      ? deliveryFee > 0
                        ? `$${formatCartMoney(deliveryFee)}`
                        : "Free"
                      : "Free (pickup)"}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryRowLabel}>{taxLabel}</span>
                  <span className={styles.summaryRowVal}>
                    ${formatCartMoney(tax)}
                  </span>
                </div>
              </div>

              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span>${formatCartMoney(grandTotal)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
