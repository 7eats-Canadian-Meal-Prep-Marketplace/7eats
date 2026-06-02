"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCart } from "../_cart-context";
import styles from "./page.module.css";

const SERVICE_FEE = 2;

export default function CartPage() {
  const { items, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className={styles.emptyPage}>
        <div className={styles.emptyIcon}>
          <ShoppingBag size={48} />
        </div>
        <h1 className={styles.emptyTitle}>Your cart is empty</h1>
        <p className={styles.emptyDesc}>
          Discover home cooks near you and start building your order.
        </p>
        <Link href="/app/browse" className={styles.browseBtn}>
          Browse listings →
        </Link>
      </div>
    );
  }

  // Group items by cook
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.cookId]) acc[item.cookId] = [];
    acc[item.cookId].push(item);
    return acc;
  }, {});

  const grandTotal = total + SERVICE_FEE;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <h1 className={styles.heading}>Your cart</h1>

          {Object.entries(grouped).map(([cookId, cookItems]) => {
            const first = cookItems[0];
            return (
              <div key={cookId} className={styles.cookSection}>
                <div className={styles.cookHeader}>
                  <div
                    className={styles.cookAvatar}
                    style={{ background: first.cookGradient }}
                  >
                    {first.cookInitials}
                  </div>
                  <div>
                    <div className={styles.cookName}>{first.cookName}</div>
                    <div className={styles.listingName}>
                      {first.listingTitle}
                    </div>
                  </div>
                </div>

                <div className={styles.itemList}>
                  {cookItems.map((item) => (
                    <div key={item.dishId} className={styles.item}>
                      <div className={styles.itemEmoji}>{item.dishEmoji}</div>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.dishName}</span>
                        <span className={styles.itemPrice}>
                          ${item.price} ea.
                        </span>
                      </div>
                      <div className={styles.itemControls}>
                        <div className={styles.qtyControl}>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() =>
                              updateQuantity(item.dishId, item.quantity - 1)
                            }
                          >
                            {item.quantity === 1 ? (
                              <Trash2 size={13} />
                            ) : (
                              <Minus size={13} />
                            )}
                          </button>
                          <span className={styles.qtyNum}>{item.quantity}</span>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() =>
                              updateQuantity(item.dishId, item.quantity + 1)
                            }
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <span className={styles.itemTotal}>
                          ${item.price * item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.cookPickup}>
                  <span>📅 Pickup: {cookItems[0].listingTitle}</span>
                  <Link
                    href={`/app/listings/${cookItems[0].listingId}`}
                    className={styles.addMoreLink}
                  >
                    Add more dishes
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Promo code */}
          <div className={styles.promoSection}>
            <input
              type="text"
              placeholder="Promo code"
              className={styles.promoInput}
            />
            <button type="button" className={styles.promoBtn}>
              Apply
            </button>
          </div>
        </div>

        {/* Order summary */}
        <aside className={styles.summary}>
          <h2 className={styles.summaryTitle}>Order summary</h2>

          <div className={styles.summaryRows}>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>${total}.00</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Service fee</span>
              <span>${SERVICE_FEE}.00</span>
            </div>
          </div>

          <div className={styles.summaryDivider} />

          <div className={styles.summaryTotal}>
            <span>Total</span>
            <span>${grandTotal}.00</span>
          </div>

          <Link href="/app/checkout" className={styles.checkoutBtn}>
            Proceed to checkout →
          </Link>

          <p className={styles.secureNote}>
            Guest checkout available — sign in anytime for faster reordering.
          </p>

          <Link href="/app/browse" className={styles.continueLink}>
            Continue browsing
          </Link>
        </aside>
      </div>
    </div>
  );
}
