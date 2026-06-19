"use client";

import { ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { NormalizedAddress } from "@/lib/types/address";
import { useApp } from "../_app-context";
import { useCart } from "../_cart-context";
import { calcTax, formatCartMoney, getTaxLabel } from "./_cart-tax";
import styles from "./page.module.css";

type DeliveryFeeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "free"; message: string }
  | { status: "fee"; fee: number }
  | { status: "out_of_range" }
  | { status: "error" };

export default function CartPage() {
  const {
    cookId,
    cookName,
    items,
    subtotal,
    totalQuantity,
    minOrderQty,
    maxOrderQty,
    meetsMinimum,
    withinMaximum,
    fulfillmentMode,
    removeItem,
  } = useCart();
  const { province } = useApp();

  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeeState>({
    status: "idle",
  });

  const hasDelivery = fulfillmentMode === "delivery" && cookId !== null;

  useEffect(() => {
    if (!hasDelivery || !cookId) {
      setDeliveryFee({ status: "idle" });
      return;
    }
    let cancelled = false;
    setDeliveryFee({ status: "loading" });

    (async () => {
      try {
        const addrRes = await fetch("/api/user/address");
        if (!addrRes.ok) {
          if (!cancelled) setDeliveryFee({ status: "idle" });
          return;
        }
        const addrData = await addrRes.json();
        const address: NormalizedAddress | null = addrData.address ?? null;
        if (!address?.lat || !address?.lng) {
          if (!cancelled) setDeliveryFee({ status: "idle" });
          return;
        }
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
        if (!res.ok) {
          if (!cancelled) setDeliveryFee({ status: "error" });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.isOutOfRange) setDeliveryFee({ status: "out_of_range" });
        else if (data.isFree)
          setDeliveryFee({ status: "free", message: "$0.00 (Free!)" });
        else setDeliveryFee({ status: "fee", fee: data.fee });
      } catch {
        if (!cancelled) setDeliveryFee({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasDelivery, cookId, subtotal]);

  const deliveryFeeAmount = deliveryFee.status === "fee" ? deliveryFee.fee : 0;

  const { tax, grandTotal, taxLabel } = useMemo(() => {
    const taxAmount =
      Math.round(calcTax(subtotal + deliveryFeeAmount, province) * 100) / 100;
    return {
      tax: taxAmount,
      grandTotal:
        Math.round((subtotal + deliveryFeeAmount + taxAmount) * 100) / 100,
      taxLabel: getTaxLabel(province),
    };
  }, [subtotal, deliveryFeeAmount, province]);

  if (items.length === 0) {
    return (
      <div className={styles.emptyPage}>
        <ShoppingCart
          size={48}
          strokeWidth={1.5}
          className={styles.emptyIcon}
          aria-hidden
        />
        <h1 className={styles.emptyTitle}>Your cart is empty</h1>
        <Link href="/app/browse" className={styles.browseBtn}>
          Browse cooks
        </Link>
      </div>
    );
  }

  const checkoutDisabled = !meetsMinimum || !withinMaximum;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.mainCol}>
          <header className={styles.pageHeader}>
            <h1 className={styles.heading}>Your cart</h1>
            <p className={styles.subheading}>
              Review your order before checkout
            </p>
          </header>

          <div className={styles.bodyRow}>
            <div className={styles.listingsCol}>
              <section className={styles.listingSection}>
                <div className={styles.listingHeader}>
                  <Link
                    href={cookId ? `/app/cooks/${cookId}/menu` : "/app/browse"}
                    className={styles.listingHeaderMain}
                  >
                    <div className={styles.listingHeaderText}>
                      <span className={styles.listingTitle}>
                        {cookName ?? "Your order"}
                      </span>
                      <span className={styles.cookName}>
                        <span className={styles.fulfillmentTag}>
                          {fulfillmentMode === "delivery"
                            ? "Delivery"
                            : "Pickup"}
                        </span>
                      </span>
                    </div>
                  </Link>
                </div>

                <ul className={styles.itemList}>
                  {items.map((item) => (
                    <li key={item.dishId} className={styles.item}>
                      <span className={styles.itemName}>
                        {item.quantity}× {item.name}
                        {item.discountAmount > 0 && (
                          <span className={styles.fulfillmentTag}>
                            {" "}
                            −${formatCartMoney(item.discountAmount)}
                          </span>
                        )}
                      </span>
                      <span className={styles.itemTotal}>
                        ${formatCartMoney(item.lineTotal)}
                        <button
                          type="button"
                          className={styles.removeListingBtn}
                          onClick={() => removeItem(item.dishId)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>

                {!meetsMinimum && (
                  <div className={styles.listingSubtotal}>
                    <span>Minimum {minOrderQty} item(s) to check out</span>
                    <span>
                      {totalQuantity}/{minOrderQty}
                    </span>
                  </div>
                )}
                {!withinMaximum && maxOrderQty != null && (
                  <div className={styles.listingSubtotal}>
                    <span>Maximum {maxOrderQty} item(s) per order</span>
                    <span>
                      {totalQuantity}/{maxOrderQty}
                    </span>
                  </div>
                )}

                <div className={styles.listingFooter}>
                  <Link
                    href={cookId ? `/app/cooks/${cookId}/menu` : "/app/browse"}
                    className={styles.menuLink}
                  >
                    Back to menu
                  </Link>
                </div>
              </section>
            </div>

            <aside className={styles.summaryCol}>
              <div className={styles.summary}>
                <p className={styles.summaryEyebrow}>Checkout</p>
                <h2 className={styles.summaryTitle}>Order summary</h2>

                <div className={styles.summarySheet}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryRowLabel}>Subtotal</span>
                    <span className={styles.summaryRowVal}>
                      ${formatCartMoney(subtotal)}
                    </span>
                  </div>

                  {hasDelivery && deliveryFee.status !== "idle" && (
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryRowLabel}>Delivery</span>
                      <span className={styles.summaryRowVal}>
                        {deliveryFee.status === "loading" && (
                          <span className={styles.deliveryFeeLoading}>
                            Calculating…
                          </span>
                        )}
                        {deliveryFee.status === "free" && (
                          <span className={styles.deliveryFeeFree}>
                            {deliveryFee.message}
                          </span>
                        )}
                        {deliveryFee.status === "fee" && (
                          <span>${formatCartMoney(deliveryFee.fee)}</span>
                        )}
                        {deliveryFee.status === "out_of_range" && (
                          <span className={styles.deliveryFeeOutOfRange}>
                            Outside delivery zone
                          </span>
                        )}
                        {deliveryFee.status === "error" && (
                          <span className={styles.deliveryFeeError}>
                            Unavailable
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {!hasDelivery && (
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryRowLabel}>Delivery</span>
                      <span className={styles.summaryRowVal}>
                        <span className={styles.deliveryFeeFree}>
                          Free (Pickup)
                        </span>
                      </span>
                    </div>
                  )}

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

                {checkoutDisabled ? (
                  <button
                    type="button"
                    className={styles.checkoutBtn}
                    disabled
                    aria-disabled
                  >
                    {!meetsMinimum
                      ? `Add ${minOrderQty - totalQuantity} more to check out`
                      : "Too many items"}
                  </button>
                ) : (
                  <Link href="/app/checkout" className={styles.checkoutBtn}>
                    Proceed to checkout
                  </Link>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
