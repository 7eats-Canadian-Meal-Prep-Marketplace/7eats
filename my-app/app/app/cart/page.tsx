"use client";

import { RefreshCw, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INTERVAL_LABELS } from "@/lib/subscription-schedule";
import type { NormalizedAddress } from "@/lib/types/address";
import { useApp } from "../_app-context";
import { type CartItem, useCart } from "../_cart-context";
import { getChargeDisclaimer } from "../_subscription-utils";
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
  const { items, removeListing, total } = useCart();
  const { province } = useApp();

  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeeState>({
    status: "idle",
  });

  // Find delivery items and their cook ID (assume single-cook cart)
  const deliveryCookId = useMemo(() => {
    const deliveryItem = items.find((i) => i.fulfillmentMode === "delivery");
    return deliveryItem?.cookId ?? null;
  }, [items]);

  const hasDelivery = deliveryCookId !== null;

  // Fetch delivery fee when cart has delivery items
  useEffect(() => {
    if (!hasDelivery) {
      setDeliveryFee({ status: "idle" });
      return;
    }

    let cancelled = false;
    setDeliveryFee({ status: "loading" });

    async function fetchDeliveryFee() {
      try {
        // Fetch user's saved address
        const addrRes = await fetch("/api/user/address");
        if (!addrRes.ok) {
          if (!cancelled) setDeliveryFee({ status: "idle" });
          return;
        }
        const addrData = await addrRes.json();
        const address: NormalizedAddress | null = addrData.address ?? null;

        if (!address?.lat || !address?.lng) {
          // No address with coordinates — can't calculate
          if (!cancelled) setDeliveryFee({ status: "idle" });
          return;
        }

        const res = await fetch("/api/delivery/distance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cookId: deliveryCookId,
            customerLat: address.lat,
            customerLng: address.lng,
            orderSubtotal: total,
          }),
        });

        if (!res.ok) {
          if (!cancelled) setDeliveryFee({ status: "error" });
          return;
        }

        const data = await res.json();

        if (!cancelled) {
          if (data.isOutOfRange) {
            setDeliveryFee({ status: "out_of_range" });
          } else if (data.isFree) {
            setDeliveryFee({ status: "free", message: "$0.00 (Free!)" });
          } else {
            setDeliveryFee({ status: "fee", fee: data.fee });
          }
        }
      } catch {
        if (!cancelled) setDeliveryFee({ status: "error" });
      }
    }

    fetchDeliveryFee();

    return () => {
      cancelled = true;
    };
  }, [hasDelivery, deliveryCookId, total]);

  const deliveryFeeAmount = deliveryFee.status === "fee" ? deliveryFee.fee : 0;

  const { tax, grandTotal, taxLabel } = useMemo(() => {
    const taxAmount =
      Math.round(calcTax(total + deliveryFeeAmount, province) * 100) / 100;
    return {
      tax: taxAmount,
      grandTotal:
        Math.round((total + deliveryFeeAmount + taxAmount) * 100) / 100,
      taxLabel: getTaxLabel(province),
    };
  }, [total, deliveryFeeAmount, province]);

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
          Browse listings
        </Link>
      </div>
    );
  }

  const grouped = items.reduce<Record<string, CartItem[]>>((acc, item) => {
    if (!acc[item.listingId]) acc[item.listingId] = [];
    acc[item.listingId].push(item);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.mainCol}>
          <header className={styles.pageHeader}>
            <h1 className={styles.heading}>Your cart</h1>
            <p className={styles.subheading}>
              Review your orders before checkout
            </p>
          </header>

          <div className={styles.bodyRow}>
            <div className={styles.listingsCol}>
              {Object.entries(grouped).map(([listingId, listingItems]) => {
                const first = listingItems[0];
                const listingSubtotal = listingItems.reduce(
                  (sum, i) => sum + i.price * i.quantity,
                  0,
                );

                return (
                  <section key={listingId} className={styles.listingSection}>
                    <div className={styles.listingHeader}>
                      <Link
                        href={`/app/listings/${listingId}`}
                        className={styles.listingHeaderMain}
                      >
                        <div className={styles.listingThumb}>
                          {/* biome-ignore lint/performance/noImgElement: listing cover */}
                          <img
                            src="/placeholder.jpg"
                            alt=""
                            className={styles.listingThumbImg}
                            width={56}
                            height={56}
                          />
                        </div>
                        <div className={styles.listingHeaderText}>
                          <span className={styles.listingTitle}>
                            {first.listingTitle}
                          </span>
                          <span className={styles.cookName}>
                            {first.cookName} ·{" "}
                            <span className={styles.fulfillmentTag}>
                              {first.fulfillmentMode === "delivery"
                                ? "Delivery"
                                : "Pickup"}
                            </span>
                          </span>
                        </div>
                      </Link>
                      <button
                        type="button"
                        className={styles.removeListingBtn}
                        onClick={() => removeListing(listingId)}
                        aria-label={`Remove ${first.listingTitle} from cart`}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <ul className={styles.itemList}>
                      {listingItems.map((item) => (
                        <li key={item.dishId} className={styles.item}>
                          <span className={styles.itemName}>
                            {item.quantity}× {item.dishName}
                          </span>
                          <span className={styles.itemTotal}>
                            ${item.price * item.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Subscription notice */}
                    {first.orderType === "subscription" &&
                      first.subscriptionInterval && (
                        <div className={styles.subscriptionNotice}>
                          <RefreshCw size={12} />
                          <span>
                            <strong>
                              {INTERVAL_LABELS[first.subscriptionInterval]}{" "}
                              subscription
                            </strong>{" "}
                            · {getChargeDisclaimer(first.subscriptionInterval)}
                          </span>
                        </div>
                      )}

                    <div className={styles.listingSubtotal}>
                      <span>Listing subtotal</span>
                      <span>${listingSubtotal}.00</span>
                    </div>

                    <div className={styles.listingFooter}>
                      <Link
                        href={`/app/listings/${listingId}`}
                        className={styles.menuLink}
                      >
                        Back to menu
                      </Link>
                    </div>
                  </section>
                );
              })}
            </div>

            <aside className={styles.summaryCol}>
              <div className={styles.summary}>
                <p className={styles.summaryEyebrow}>Checkout</p>
                <h2 className={styles.summaryTitle}>Order summary</h2>

                <div className={styles.summarySheet}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryRowLabel}>Subtotal</span>
                    <span className={styles.summaryRowVal}>
                      ${formatCartMoney(total)}
                    </span>
                  </div>

                  {/* Delivery fee line item */}
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

                  {/* Pickup-only hint */}
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

                <Link href="/app/checkout" className={styles.checkoutBtn}>
                  Proceed to checkout
                </Link>
              </div>

              <div className={styles.promoSection}>
                <label htmlFor="cart-promo" className={styles.promoLabel}>
                  Promo code
                </label>
                <div className={styles.promoRow}>
                  <input
                    id="cart-promo"
                    type="text"
                    placeholder="Enter code"
                    className={styles.promoInput}
                  />
                  <button type="button" className={styles.promoBtn}>
                    Apply
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
