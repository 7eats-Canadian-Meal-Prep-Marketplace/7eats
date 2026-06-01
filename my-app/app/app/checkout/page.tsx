"use client";

import { ArrowLeft, CreditCard, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "../_cart-context";
import styles from "./page.module.css";

const SERVICE_FEE = 2;

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "",
    card: "",
    expiry: "",
    cvv: "",
  });

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.cookId]) acc[item.cookId] = [];
    acc[item.cookId].push(item);
    return acc;
  }, {});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePlaceOrder = () => {
    setPlacing(true);
    setTimeout(() => {
      clearCart();
      router.push("/app/orders?success=1");
    }, 1400);
  };

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
      {/* Header */}
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

      <div className={styles.inner}>
        {/* Left: form */}
        <div className={styles.formSide}>
          {/* Contact info */}
          <section className={styles.formSection}>
            <h2 className={styles.formTitle}>Contact info</h2>
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
                  value={form.firstName}
                  onChange={handleChange}
                />
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
                  value={form.lastName}
                  onChange={handleChange}
                />
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
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="phone">
                Phone (for pickup coordination)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 (416) 555-0000"
                className={styles.input}
                value={form.phone}
                onChange={handleChange}
              />
            </div>
          </section>

          {/* Pickup details */}
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
                    <div className={styles.pickupCook}>{first.cookName}</div>
                    <div className={styles.pickupListing}>
                      {first.listingTitle}
                    </div>
                    <div className={styles.pickupMeta}>
                      Details confirmed at order
                    </div>
                  </div>
                </div>
              );
            })}
            <p className={styles.pickupNote}>
              After placing your order, you'll receive a pickup code to share
              with your cook.
            </p>
          </section>

          {/* Payment */}
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
                value={form.card}
                onChange={handleChange}
                maxLength={19}
              />
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
                  value={form.expiry}
                  onChange={handleChange}
                  maxLength={7}
                />
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
                  value={form.cvv}
                  onChange={handleChange}
                  maxLength={3}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: summary */}
        <aside className={styles.summary}>
          {/* First order banner */}
          <div className={styles.firstOrderBanner}>
            🎉 <strong>First order?</strong> Save $5 with code{" "}
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
            <span>${total + SERVICE_FEE}.00</span>
          </div>

          <button
            type="button"
            className={styles.placeOrderBtn}
            onClick={handlePlaceOrder}
            disabled={placing}
          >
            {placing
              ? "Placing order..."
              : `Place order · $${total + SERVICE_FEE}.00`}
          </button>

          <p className={styles.terms}>
            By placing your order you agree to 7eats'{" "}
            <button type="button" className={styles.termsLink}>
              Terms of Service
            </button>
            . Your payment is held securely until pickup is confirmed.
          </p>
        </aside>
      </div>
    </div>
  );
}
