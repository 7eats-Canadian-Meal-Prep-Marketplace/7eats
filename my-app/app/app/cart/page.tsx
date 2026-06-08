"use client";

import { RefreshCw, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { type CartItem, useCart } from "../_cart-context";
import { WEEKLY_CHARGE_DISCLAIMER } from "../_subscription-utils";
import {
  calcOntarioHst,
  formatCartMoney,
  ONTARIO_HST_LABEL,
} from "./_cart-tax";
import styles from "./page.module.css";

export default function CartPage() {
  const { items, removeListing, total } = useCart();

  const { tax, grandTotal } = useMemo(() => {
    const taxAmount = calcOntarioHst(total);
    return {
      tax: taxAmount,
      grandTotal: Math.round((total + taxAmount) * 100) / 100,
    };
  }, [total]);

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

                    {/* Weekly subscription notice */}
                    {first.orderType === "subscription" && (
                      <div className={styles.subscriptionNotice}>
                        <RefreshCw size={12} />
                        <span>
                          <strong>Weekly subscription</strong> ·{" "}
                          {WEEKLY_CHARGE_DISCLAIMER}
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
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryRowLabel}>
                      {ONTARIO_HST_LABEL}
                      <span className={styles.taxNote}>Ontario</span>
                    </span>
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
