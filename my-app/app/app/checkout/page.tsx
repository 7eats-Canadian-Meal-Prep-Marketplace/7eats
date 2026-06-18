"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { refundPolicyText } from "@/lib/refund-policy";
import type { NormalizedAddress } from "@/lib/types/address";
import { useApp } from "../_app-context";
import { useCart } from "../_cart-context";
import { calcTax, formatCartMoney, getTaxLabel } from "../cart/_cart-tax";
import { NewCardForm } from "./_payment-form";
import styles from "./page.module.css";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

export default function CheckoutPage() {
  const router = useRouter();
  const { province } = useApp();
  const {
    cookId,
    cookName,
    items,
    subtotal,
    totalQuantity,
    meetsMinimum,
    fulfillmentMode,
    pickupAt,
    deliveryAddress,
    notes,
    cancellationAllowed,
    leadTime,
    clearCart,
  } = useCart();

  const [agreedPolicy, setAgreedPolicy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    deliveryAddress?.lat && deliveryAddress?.lng
      ? { lat: deliveryAddress.lat, lng: deliveryAddress.lng }
      : null,
  );

  const isDelivery = fulfillmentMode === "delivery";

  useEffect(() => {
    if (items.length === 0 && !placing && !ordered) router.replace("/app/cart");
  }, [items.length, placing, ordered, router]);

  useEffect(() => {
    if (!isDelivery || !cookId) {
      setDeliveryFee(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const addrRes = await fetch("/api/user/address");
        const addrData = addrRes.ok ? await addrRes.json() : null;
        const address: NormalizedAddress | null = addrData?.address ?? null;
        if (!address?.lat || !address?.lng) return;
        if (!cancelled) setCoords({ lat: address.lat, lng: address.lng });
        const res = await fetch("/api/delivery/distance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cookId,
            customerLat: address.lat,
            customerLng: address.lng,
            orderSubtotal: subtotal,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && !data.isOutOfRange && !data.isFree) {
          setDeliveryFee(data.fee ?? 0);
        }
      } catch {
        /* non-fatal — the server snapshots the authoritative fee */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDelivery, cookId, subtotal]);

  const { tax, grandTotal, taxLabel } = useMemo(() => {
    const taxAmount =
      Math.round(calcTax(subtotal + deliveryFee, province) * 100) / 100;
    return {
      tax: taxAmount,
      grandTotal: Math.round((subtotal + deliveryFee + taxAmount) * 100) / 100,
      taxLabel: getTaxLabel(province),
    };
  }, [subtotal, deliveryFee, province]);

  async function placeOrder(paymentMethodId: string) {
    if (!cookId) return;
    if (!pickupAt) {
      setError("Please choose a pickup time on the menu before checking out.");
      return;
    }
    if (!agreedPolicy) {
      setError(
        "Please confirm you understand this cook's cancellation policy.",
      );
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cookId,
          dishes: items.map((i) => ({
            dishId: i.dishId,
            quantity: i.quantity,
            promotionId: i.promotionId,
          })),
          paymentMethodId,
          pickupAt,
          fulfillmentMode,
          deliveryAddress: isDelivery ? deliveryAddress : undefined,
          customerLat: isDelivery ? coords?.lat : undefined,
          customerLng: isDelivery ? coords?.lng : undefined,
          notes: notes ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not place your order.");
        setPlacing(false);
        return;
      }
      setOrdered(true);
      const params = new URLSearchParams({
        count: "1",
        oid0: data.data.orderId,
        cook0: cookName ?? "Your cook",
        mode0: fulfillmentMode,
      });
      clearCart();
      router.push(`/app/checkout/confirmation?${params.toString()}`);
    } catch {
      setError("Network error — please try again.");
      setPlacing(false);
    }
  }

  if (items.length === 0 && !placing && !ordered) return null;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.pageHeader}>
          <h1 className={styles.heading}>Checkout</h1>
          <p className={styles.subheading}>
            {cookName ? `Order from ${cookName}` : "Review and pay"}
          </p>
        </header>

        <div className={styles.bodyRow}>
          <section className={styles.mainCol}>
            <h2 className={styles.sectionTitle}>Your items</h2>
            <ul className={styles.itemList}>
              {items.map((item) => (
                <li key={item.dishId} className={styles.item}>
                  <span>
                    {item.quantity}× {item.name}
                    {item.discountAmount > 0 && (
                      <span> (−${formatCartMoney(item.discountAmount)})</span>
                    )}
                  </span>
                  <span>${formatCartMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <h2 className={styles.sectionTitle}>Cancellation policy</h2>
            <div
              style={{
                border: "1px solid var(--grey-200, #e5e7eb)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 16,
                background: cancellationAllowed
                  ? "var(--white, #fff)"
                  : "#fff5f5",
              }}
            >
              <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                {refundPolicyText(cancellationAllowed, pickupAt, leadTime)}
              </p>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={agreedPolicy}
                  onChange={(e) => setAgreedPolicy(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  I understand{cookName ? ` ${cookName}'s` : ""} cancellation
                  policy{" "}
                  {cancellationAllowed
                    ? "and refund window."
                    : "and that this sale is final."}
                </span>
              </label>
            </div>

            <h2 className={styles.sectionTitle}>Payment</h2>
            {!meetsMinimum && (
              <p className={styles.fieldError}>
                Your cart no longer meets the minimum order. Please return to
                the menu.
              </p>
            )}
            {error && (
              <p className={styles.fieldError} role="alert">
                {error}
              </p>
            )}
            <Elements stripe={stripePromise}>
              <NewCardForm onTokenized={placeOrder} loading={placing} />
            </Elements>
            <Link href="/app/cart" className={styles.backLink}>
              ← Back to cart
            </Link>
          </section>

          <aside className={styles.summaryCol}>
            <div className={styles.summary}>
              <h2 className={styles.summaryTitle}>Order summary</h2>
              <div className={styles.summaryRow}>
                <span>Subtotal ({totalQuantity})</span>
                <span>${formatCartMoney(subtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Delivery</span>
                <span>
                  {isDelivery
                    ? deliveryFee > 0
                      ? `$${formatCartMoney(deliveryFee)}`
                      : "Free"
                    : "Free (Pickup)"}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span>{taxLabel}</span>
                <span>${formatCartMoney(tax)}</span>
              </div>
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span>${formatCartMoney(grandTotal)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
