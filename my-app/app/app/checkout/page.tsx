"use client";

import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Lock,
  LogIn,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useApp } from "../_app-context";
import { useCart } from "../_cart-context";
import styles from "./page.module.css";

const SERVICE_FEE = 2;

type CheckoutStep = "details" | "account" | "payment";

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type PaymentForm = {
  card: string;
  expiry: string;
  cvv: string;
};

const EMPTY_CONTACT: ContactForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const EMPTY_PAYMENT: PaymentForm = {
  card: "",
  expiry: "",
  cvv: "",
};

function CheckoutInner() {
  const { items, total, clearCart } = useCart();
  const { isLoggedIn } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStep =
    (searchParams.get("step") as CheckoutStep | null) ?? "details";
  const [step, setStep] = useState<CheckoutStep>(
    initialStep === "payment" && isLoggedIn ? "payment" : initialStep,
  );
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT);
  const [payment, setPayment] = useState<PaymentForm>(EMPTY_PAYMENT);
  const [checkoutMode, setCheckoutMode] = useState<"guest" | "account">(
    isLoggedIn ? "account" : "guest",
  );

  useEffect(() => {
    if (isLoggedIn) {
      setContact({
        firstName: "Jordan",
        lastName: "Doe",
        email: "jordan@example.com",
        phone: "+1 (416) 555-0100",
      });
      setCheckoutMode("account");
    }
  }, [isLoggedIn]);

  const steps = useMemo(() => {
    if (isLoggedIn) {
      return [
        { id: "details" as const, label: "Details" },
        { id: "payment" as const, label: "Payment" },
      ];
    }
    return [
      { id: "details" as const, label: "Details" },
      { id: "account" as const, label: "Account" },
      { id: "payment" as const, label: "Payment" },
    ];
  }, [isLoggedIn]);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.cookId]) acc[item.cookId] = [];
    acc[item.cookId].push(item);
    return acc;
  }, {});

  const grandTotal = total + SERVICE_FEE;
  const loginNext = `/app/checkout?step=${isLoggedIn ? "payment" : "account"}`;

  function validateDetails(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!contact.firstName.trim()) nextErrors.firstName = "Required";
    if (!contact.lastName.trim()) nextErrors.lastName = "Required";
    if (!contact.email.trim()) nextErrors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
      nextErrors.email = "Enter a valid email";
    }
    if (!contact.phone.trim()) nextErrors.phone = "Required for pickup updates";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validatePayment(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!payment.card.trim()) nextErrors.card = "Required";
    if (!payment.expiry.trim()) nextErrors.expiry = "Required";
    if (!payment.cvv.trim()) nextErrors.cvv = "Required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goToAccountOrPayment() {
    if (isLoggedIn) setStep("payment");
    else setStep("account");
  }

  function handlePlaceOrder() {
    if (!validatePayment()) return;
    setPlacing(true);
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    setTimeout(() => {
      clearCart();
      const params = new URLSearchParams({ order: orderId });
      if (!isLoggedIn && checkoutMode === "guest") {
        params.set("guest", "1");
        params.set("email", contact.email.trim());
      }
      router.push(`/app/checkout/confirmation?${params.toString()}`);
    }, 1200);
  }

  if (items.length === 0) {
    return (
      <div className={styles.emptyPage}>
        <p>Your cart is empty.</p>
        <Link href="/app/browse" className={styles.browseBtn}>
          Browse listings
        </Link>
      </div>
    );
  }

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
          {step === "details" && (
            <>
              <section className={styles.formSection}>
                <h2 className={styles.formTitle}>Contact & pickup</h2>
                <p className={styles.sectionLead}>
                  We'll send your order confirmation and pickup code here.
                </p>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="firstName">
                      First name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      className={styles.input}
                      value={contact.firstName}
                      onChange={(e) =>
                        setContact((c) => ({ ...c, firstName: e.target.value }))
                      }
                    />
                    {errors.firstName && (
                      <p className={styles.fieldError}>{errors.firstName}</p>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="lastName">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      className={styles.input}
                      value={contact.lastName}
                      onChange={(e) =>
                        setContact((c) => ({ ...c, lastName: e.target.value }))
                      }
                    />
                    {errors.lastName && (
                      <p className={styles.fieldError}>{errors.lastName}</p>
                    )}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={styles.input}
                    value={contact.email}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, email: e.target.value }))
                    }
                  />
                  {errors.email && (
                    <p className={styles.fieldError}>{errors.email}</p>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (416) 555-0000"
                    className={styles.input}
                    value={contact.phone}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, phone: e.target.value }))
                    }
                  />
                  {errors.phone && (
                    <p className={styles.fieldError}>{errors.phone}</p>
                  )}
                </div>
              </section>

              <section className={styles.formSection}>
                <h2 className={styles.formTitle}>Pickup details</h2>
                {Object.entries(grouped).map(([cookId, cookItems]) => {
                  const first = cookItems[0];
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
                onClick={() => {
                  if (validateDetails()) goToAccountOrPayment();
                }}
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </>
          )}

          {step === "account" && !isLoggedIn && (
            <>
              <section className={styles.formSection}>
                <h2 className={styles.formTitle}>
                  How would you like to continue?
                </h2>
                <p className={styles.sectionLead}>
                  Guest checkout is available — no account required. Sign in if
                  you already have one for saved details and order history.
                </p>

                <button
                  type="button"
                  className={`${styles.choiceCard} ${checkoutMode === "guest" ? styles.choiceCardActive : ""}`}
                  onClick={() => {
                    setCheckoutMode("guest");
                    setStep("payment");
                  }}
                >
                  <span className={styles.choiceTitle}>Continue as guest</span>
                  <span className={styles.choiceDesc}>
                    Check out with {contact.email || "your email"} — create an
                    account later from your confirmation.
                  </span>
                </button>

                <Link
                  href={`/app-auth/login?next=${encodeURIComponent(loginNext)}`}
                  className={styles.choiceCard}
                >
                  <span className={styles.choiceIcon}>
                    <LogIn size={18} />
                  </span>
                  <span className={styles.choiceTitle}>Sign in</span>
                  <span className={styles.choiceDesc}>
                    Use your 7eats account for faster checkout and order
                    tracking.
                  </span>
                </Link>

                <Link
                  href={`/app-auth/signup?next=${encodeURIComponent("/app/checkout?step=payment")}`}
                  className={styles.choiceCard}
                >
                  <span className={styles.choiceIcon}>
                    <UserPlus size={18} />
                  </span>
                  <span className={styles.choiceTitle}>Create an account</span>
                  <span className={styles.choiceDesc}>
                    Save your details, track orders, and reorder in one tap.
                  </span>
                </Link>
              </section>

              <button
                type="button"
                className={styles.textBtn}
                onClick={() => setStep("details")}
              >
                ← Back to details
              </button>
            </>
          )}

          {step === "payment" && (
            <>
              {!isLoggedIn && checkoutMode === "guest" && (
                <div className={styles.guestBanner}>
                  Checking out as guest ·{" "}
                  <button
                    type="button"
                    className={styles.inlineLink}
                    onClick={() => setStep("account")}
                  >
                    Sign in instead
                  </button>
                </div>
              )}

              <section className={styles.formSection}>
                <h2 className={styles.formTitle}>
                  <CreditCard size={16} /> Payment
                </h2>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="card">
                    Card number
                  </label>
                  <input
                    id="card"
                    name="card"
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    className={styles.input}
                    value={payment.card}
                    onChange={(e) =>
                      setPayment((p) => ({ ...p, card: e.target.value }))
                    }
                    maxLength={19}
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
                      name="expiry"
                      type="text"
                      placeholder="MM / YY"
                      className={styles.input}
                      value={payment.expiry}
                      onChange={(e) =>
                        setPayment((p) => ({ ...p, expiry: e.target.value }))
                      }
                      maxLength={7}
                    />
                    {errors.expiry && (
                      <p className={styles.fieldError}>{errors.expiry}</p>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="cvv">
                      CVV
                    </label>
                    <input
                      id="cvv"
                      name="cvv"
                      type="text"
                      placeholder="•••"
                      className={styles.input}
                      value={payment.cvv}
                      onChange={(e) =>
                        setPayment((p) => ({ ...p, cvv: e.target.value }))
                      }
                      maxLength={3}
                    />
                    {errors.cvv && (
                      <p className={styles.fieldError}>{errors.cvv}</p>
                    )}
                  </div>
                </div>
              </section>

              <div className={styles.stepActions}>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setStep(isLoggedIn ? "details" : "account")}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className={styles.placeOrderBtn}
                  onClick={handlePlaceOrder}
                  disabled={placing}
                >
                  {placing
                    ? "Placing order…"
                    : `Place order · $${grandTotal}.00`}
                </button>
              </div>
            </>
          )}
        </div>

        <OrderSummary items={items} total={total} grandTotal={grandTotal} />
      </div>
    </div>
  );
}

function OrderSummary({
  items,
  total,
  grandTotal,
}: {
  items: ReturnType<typeof useCart>["items"];
  total: number;
  grandTotal: number;
}) {
  return (
    <aside className={styles.summary}>
      <div className={styles.firstOrderBanner}>
        <strong>First order?</strong> Save $5 with code{" "}
        <code className={styles.promoCode}>FIRST5</code>
      </div>

      <h2 className={styles.summaryTitle}>Order summary</h2>

      {items.map((item) => (
        <div key={item.dishId} className={styles.summaryItem}>
          <span className={styles.summaryItemEmoji}>{item.dishEmoji}</span>
          <span className={styles.summaryItemName}>
            {item.quantity}× {item.dishName}
          </span>
          <span className={styles.summaryItemPrice}>
            ${item.price * item.quantity}
          </span>
        </div>
      ))}

      <div className={styles.summaryDivider} />

      <div className={styles.summaryRow}>
        <span>Subtotal</span>
        <span>${total}.00</span>
      </div>
      <div className={styles.summaryRow}>
        <span>Service fee</span>
        <span>${SERVICE_FEE}.00</span>
      </div>

      <div className={styles.summaryDivider} />

      <div className={styles.summaryTotal}>
        <span>Total</span>
        <span>${grandTotal}.00</span>
      </div>

      <p className={styles.terms}>
        Payment is held securely until pickup is confirmed.
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
