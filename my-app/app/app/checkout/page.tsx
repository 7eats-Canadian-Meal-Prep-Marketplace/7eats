"use client";

import {
  ArrowLeft,
  Check,
  MapPin,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
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
import { DELIVERY_HANDOFF_DISCLAIMER } from "@/lib/orders/delivery-details-copy";
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
import { Skeleton } from "../_skeleton";
import { calcTax, formatCartMoney } from "../cart/_cart-tax";
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

// Inline email verification for guests. A guest must prove they can read mail at
// the address they typed before the order (and its receipt) is created for it.
// Lives under the email field: a quiet "Send code" once the email is valid, then
// a compact code panel with a resend cooldown, then a calm verified state.
function GuestEmailVerify({
  email,
  emailValid,
  verified,
  onVerified,
}: {
  email: string;
  emailValid: boolean;
  verified: boolean;
  onVerified: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();

  // If the email is edited away from what we sent to, collapse back to idle.
  useEffect(() => {
    if (sentTo && normalized !== sentTo) {
      setPhase("idle");
      setCode("");
      setError(null);
      setSentTo(null);
    }
  }, [normalized, sentTo]);

  // Resend cooldown ticker — one decrement per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest-email/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Couldn't send a code. Try again.");
        return;
      }
      setSentTo(normalized);
      setPhase("sent");
      setCode("");
      setCooldown(40);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function submitCode() {
    if (code.length < 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest-email/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "That code didn't work. Try again.");
        setCode("");
        return;
      }
      onVerified();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  if (verified) {
    return (
      <output className={styles.verifyDone}>
        <Check size={15} aria-hidden="true" />
        Email verified
      </output>
    );
  }

  if (phase === "idle") {
    return (
      <div className={styles.verifyIdle}>
        <p className={styles.verifyHint}>
          <ShieldCheck size={14} aria-hidden="true" />
          We&apos;ll email a code to confirm this address before payment.
        </p>
        <button
          type="button"
          className={styles.verifySendBtn}
          onClick={() => void sendCode()}
          disabled={!emailValid || sending}
        >
          {sending ? "Sending…" : "Send code"}
        </button>
        {error && (
          <p className={styles.verifyError} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.verifyPanel}>
      <p className={styles.verifySentTo}>
        Enter the 6-digit code sent to <strong>{sentTo}</strong>.
      </p>
      <div className={styles.verifyRow}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submitCode();
            }
          }}
          placeholder="000000"
          className={styles.verifyCodeInput}
          aria-label="Verification code"
          aria-invalid={Boolean(error)}
        />
        <button
          type="button"
          className={styles.verifyConfirmBtn}
          onClick={() => void submitCode()}
          disabled={code.length < 6 || verifying}
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
      </div>
      {error && (
        <p className={styles.verifyError} role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className={styles.verifyResendBtn}
        onClick={() => void sendCode()}
        disabled={cooldown > 0 || sending}
      >
        {cooldown > 0
          ? `Resend code in ${cooldown}s`
          : sending
            ? "Sending…"
            : "Resend code"}
      </button>
    </div>
  );
}

type UnavailableCartItem = {
  dishId: string;
  name: string;
};

function UnavailableMealsAlert({
  items,
  cookId,
}: {
  items: UnavailableCartItem[];
  cookId: string | null;
}) {
  if (items.length === 0) return null;

  const menuHref = cookId ? `/app/cooks/${cookId}/menu` : "/app/browse";

  return (
    <div className={styles.unavailableAlert} role="alert">
      <div className={styles.unavailableAlertHead}>
        <div className={styles.unavailableAlertIcon} aria-hidden="true">
          <UtensilsCrossed size={17} strokeWidth={1.75} />
        </div>
        <p className={styles.unavailableAlertTitle}>
          {items.length === 1
            ? "A meal in your cart is no longer available"
            : "Some meals in your cart are no longer available"}
        </p>
      </div>
      <div className={styles.unavailableAlertBody}>
        <ul className={styles.unavailableAlertTags}>
          {items.map((item) => (
            <li key={item.dishId} className={styles.unavailableAlertTag}>
              {item.name}
            </li>
          ))}
        </ul>
        <p className={styles.unavailableAlertCopy}>
          The cook paused {items.length === 1 ? "this meal" : "these meals"}{" "}
          while you were checking out. Remove{" "}
          {items.length === 1 ? "it" : "them"} from your cart or pick something
          else to continue.
        </p>
        <div className={styles.unavailableAlertActions}>
          <Link href="/app/cart" className={styles.unavailableAlertPrimary}>
            Update cart
          </Link>
          <Link href={menuHref} className={styles.unavailableAlertSecondary}>
            Browse menu
          </Link>
        </div>
      </div>
    </div>
  );
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
    deliveryDetails,
    cancellationAllowed,
    leadTime,
    setDeliveryAddress,
    setDeliveryDetails,
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
  // Guests must verify their email (OTP) before the order is placed.
  const [emailVerified, setEmailVerified] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryOutOfRange, setDeliveryOutOfRange] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [pendingAddress, setPendingAddress] =
    useState<NormalizedAddress | null>(null);
  const [deliveryDetailsDraft, setDeliveryDetailsDraft] = useState(
    deliveryDetails ?? "",
  );
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [discount, setDiscount] = useState<{
    amount: number;
    name: string | null;
  }>({ amount: 0, name: null });
  const [pickupWindows, setPickupWindows] = useState<FulfillmentWindow[]>([]);
  const [deliveryWindows, setDeliveryWindows] = useState<FulfillmentWindow[]>(
    [],
  );
  // Cook's pickup address, shown for pickup orders. Loaded with the menu sync.
  const [pickupLocation, setPickupLocation] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{
    orderId: string;
    clientSecret: string;
    guestAccessToken?: string;
  } | null>(null);
  const [unavailableItems, setUnavailableItems] = useState<
    UnavailableCartItem[]
  >([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const isDelivery = fulfillmentMode === "delivery";
  const displayAddress = pendingAddress ?? currentAddress;
  // Once the order exists (payment pending), the contact details are committed to
  // it — editing them would mislead, so the whole section freezes read-only.
  const contactLocked = Boolean(pendingPayment);

  useEffect(() => {
    if (items.length === 0 && !placing && !ordered) router.replace("/app/cart");
  }, [items.length, placing, ordered, router]);

  useEffect(() => {
    setDeliveryDetailsDraft(deliveryDetails ?? "");
  }, [deliveryDetails]);

  const syncCartAvailability = useCallback(async () => {
    if (!cookId || items.length === 0) {
      setUnavailableItems([]);
      return;
    }

    setCheckingAvailability(true);
    try {
      const res = await fetch(`/api/cooks/${cookId}/menu`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.data) return;

      const cook = json.data.cook;
      setPickupWindows(cook.pickupWindows ?? []);
      setDeliveryWindows(cook.deliveryWindows ?? []);
      setPickupLocation(cook.pickupLocation ?? null);

      const activeIds = new Set<string>(
        (json.data.dishes as { id: string }[] | undefined)?.map((d) => d.id) ??
          [],
      );
      setUnavailableItems(
        items
          .filter((item) => !activeIds.has(item.dishId))
          .map((item) => ({ dishId: item.dishId, name: item.name })),
      );
    } catch {
      /* non-fatal — place-order still validates server-side */
    } finally {
      setCheckingAvailability(false);
    }
  }, [cookId, items]);

  useEffect(() => {
    void syncCartAvailability();
  }, [syncCartAvailability]);

  useEffect(() => {
    function onFocus() {
      void syncCartAvailability();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncCartAvailability]);

  const applyUnavailableOrderError = useCallback(
    (data: {
      code?: string;
      unavailableDishes?: { dishId: string; name: string }[];
    }) => {
      if (
        data.code !== "dishes_unavailable" ||
        !data.unavailableDishes?.length
      ) {
        return false;
      }

      setUnavailableItems(
        data.unavailableDishes.map((dish) => ({
          dishId: dish.dishId,
          name:
            dish.name === "A meal in your cart"
              ? (items.find((item) => item.dishId === dish.dishId)?.name ??
                dish.name)
              : dish.name,
        })),
      );
      setError(null);
      return true;
    },
    [items],
  );

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

  useEffect(() => {
    let cancelled = false;
    if (subtotal <= 0) {
      setDiscount({ amount: 0, name: null });
      return;
    }
    fetch(`/api/discounts/preview?subtotal=${subtotal}`)
      .then((r) => r.json())
      .then((j: { amount?: number; name?: string | null }) => {
        if (!cancelled)
          setDiscount({ amount: j.amount ?? 0, name: j.name ?? null });
      })
      .catch(() => {
        if (!cancelled) setDiscount({ amount: 0, name: null });
      });
    return () => {
      cancelled = true;
    };
  }, [subtotal]);

  const grandTotal = useMemo(() => {
    const taxAmount =
      Math.round(calcTax(subtotal + deliveryFee, cookProvince) * 100) / 100;
    const total =
      Math.round((subtotal + deliveryFee + taxAmount - discount.amount) * 100) /
      100;
    return Math.max(0, total);
  }, [subtotal, deliveryFee, cookProvince, discount.amount]);

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
    // Changing the email invalidates any prior verification of the old address.
    if (field === "email") setEmailVerified(false);
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

    if (unavailableItems.length > 0) return;

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
        const trimmedDeliveryDetails = deliveryDetailsDraft.trim();
        if (isDelivery && trimmedDeliveryDetails !== (deliveryDetails ?? "")) {
          setDeliveryDetails(trimmedDeliveryDetails || null);
        }

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
          notes: notes ?? undefined,
          deliveryDetails: isDelivery
            ? trimmedDeliveryDetails || undefined
            : undefined,
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
          if (guestData.needsEmailVerification) {
            setEmailVerified(false);
            setError("Your email verification expired. Please verify again.");
            return;
          }
          if (!guestRes.ok) {
            if (
              applyUnavailableOrderError({
                code: guestData.code,
                unavailableDishes: guestData.unavailableDishes,
              })
            ) {
              return;
            }
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
          if (
            applyUnavailableOrderError({
              code: data.code,
              unavailableDishes: data.unavailableDishes,
            })
          ) {
            return;
          }
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
            {contactLocked && (
              <p className={styles.contactLockNote}>
                Locked in for this order. Cancel to start over with different
                details.
              </p>
            )}
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
                      disabled={contactLocked}
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
                      disabled={contactLocked}
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
                  {emailVerified ? (
                    <div className={styles.verifiedEmailRow}>
                      <span className={styles.verifiedEmailMain}>
                        <Check size={15} aria-hidden="true" />
                        <span
                          className={styles.verifiedEmailAddr}
                          title={email}
                        >
                          {email}
                        </span>
                        <span className={styles.verifiedTag}>Verified</span>
                      </span>
                      {!contactLocked && (
                        <button
                          type="button"
                          className={styles.changeEmailBtn}
                          onClick={() => setEmailVerified(false)}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
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
                        disabled={contactLocked}
                        aria-invalid={Boolean(contactErrors.email)}
                        aria-describedby={
                          contactErrors.email
                            ? "checkout-email-error"
                            : undefined
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
                      {!contactLocked && (
                        <GuestEmailVerify
                          email={email}
                          emailValid={EMAIL_RE.test(email.trim())}
                          verified={emailVerified}
                          onVerified={() => setEmailVerified(true)}
                        />
                      )}
                    </>
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
                    disabled={contactLocked}
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
                <div aria-busy="true">
                  <Skeleton width="60%" height={15} radius={6} />
                  <Skeleton
                    width="40%"
                    height={13}
                    radius={6}
                    style={{ marginTop: 10 }}
                  />
                </div>
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
              <div
                className={`${styles.formGroup} ${styles.deliveryDetailsGroup}`}
              >
                <label
                  className={styles.label}
                  htmlFor="checkout-delivery-details"
                >
                  Delivery details (optional)
                </label>
                <textarea
                  id="checkout-delivery-details"
                  className={styles.textarea}
                  rows={3}
                  maxLength={500}
                  placeholder="Ring doorbell, side entrance, buzzer code…"
                  value={deliveryDetailsDraft}
                  onChange={(e) => setDeliveryDetailsDraft(e.target.value)}
                />
                <p className={styles.fieldDisclaimer}>
                  {DELIVERY_HANDOFF_DISCLAIMER}
                </p>
              </div>
            </section>
          )}

          {/* Pickup location — where the client collects a pickup order. Shown
              once the cook's address loads with the menu sync. */}
          {!isDelivery && pickupLocation && (
            <section className={styles.formSection}>
              <h2 className={styles.formTitle}>Pickup location</h2>
              <div className={styles.addressSummary}>
                <p className={styles.pickupAddressLine}>
                  <MapPin
                    size={16}
                    className={styles.pickupAddressIcon}
                    aria-hidden="true"
                  />
                  <span>{pickupLocation}</span>
                </p>
              </div>
              <p className={styles.fieldDisclaimer}>
                Collect your order from {cookName ?? "the cook"} here during
                your selected pickup window.
              </p>
            </section>
          )}

          {/* Payment — only appears once the order total is locked in and a
              secure payment session exists (after "Continue to payment"), so
              there's no empty placeholder sitting in the flow beforehand. */}
          {pendingPayment && (
            <section className={styles.formSection}>
              <h2 className={styles.formTitle}>Payment</h2>
              <CheckoutPaymentSection
                ref={paymentRef}
                clientSecret={pendingPayment.clientSecret}
                isLoggedIn={isLoggedIn}
                userEmail={isLoggedIn ? userEmail : null}
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
              <UnavailableMealsAlert items={unavailableItems} cookId={cookId} />

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
                  checkingAvailability ||
                  unavailableItems.length > 0 ||
                  (pendingPayment ? !paymentReady : false) ||
                  !agreedPolicy ||
                  (isDelivery && deliveryOutOfRange) ||
                  (!isLoggedIn && !pendingPayment && !emailVerified)
                }
                onClick={() => void placeOrder()}
              >
                {placing
                  ? "Processing…"
                  : unavailableItems.length > 0
                    ? "Update cart to continue"
                    : pendingPayment
                      ? `Pay $${formatCartMoney(grandTotal)}`
                      : "Continue to payment"}
              </button>

              {!isLoggedIn && !pendingPayment && !emailVerified && (
                <p className={styles.ctaGateHint}>
                  Verify your email above to continue to payment.
                </p>
              )}

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
                {discount.amount > 0 && (
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryRowLabel}>
                      {discount.name ?? "Discount"}
                    </span>
                    <span className={styles.summaryRowVal}>
                      −${formatCartMoney(discount.amount)}
                    </span>
                  </div>
                )}
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
