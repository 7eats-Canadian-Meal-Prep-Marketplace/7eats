"use client";

import {
  ArrowLeft,
  CalendarClock,
  NotebookPen,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PlatformDiscountSignupPrompt from "@/app/components/PlatformDiscountSignupPrompt";
import {
  type FulfillmentWindow,
  nextFulfillmentWindowLabel,
} from "@/lib/cooks/card-schedule";
import { useApp } from "../_app-context";
import { useCart } from "../_cart-context";
import { calcTax, formatCartMoney, getTaxLabel } from "./_cart-tax";
import styles from "./page.module.css";

const NOTE_COLLAPSE_CHARS = 120;

function NotePreview({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const long =
    notes.length > NOTE_COLLAPSE_CHARS || notes.split("\n").length > 2;

  return (
    <div className={styles.noteBlock}>
      <span className={styles.noteLabel}>
        <NotebookPen size={13} aria-hidden />
        Note for the cook
      </span>
      <p
        className={
          expanded || !long ? styles.noteTextExpanded : styles.noteText
        }
      >
        {notes}
      </p>
      {long && (
        <button
          type="button"
          className={styles.noteToggle}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export default function CartPage() {
  const { platformDiscountEligible } = useApp();
  const {
    cookId,
    cookName,
    cookProvince,
    items,
    subtotal,
    totalQuantity,
    minOrderQty,
    maxOrderQty,
    meetsMinimum,
    withinMaximum,
    fulfillmentMode,
    notes,
    removeItem,
    leadTime,
    leadTimeCutoff,
  } = useCart();

  const [pickupWindows, setPickupWindows] = useState<FulfillmentWindow[]>([]);
  const [deliveryWindows, setDeliveryWindows] = useState<FulfillmentWindow[]>(
    [],
  );

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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cookId]);

  const menuHref = cookId ? `/app/cooks/${cookId}/menu` : "/app/browse";
  const isDelivery = fulfillmentMode === "delivery";

  const fulfillmentLabel = useMemo(
    () =>
      nextFulfillmentWindowLabel(
        fulfillmentMode,
        pickupWindows,
        deliveryWindows,
        leadTime,
        new Date(),
        leadTimeCutoff,
      ),
    [fulfillmentMode, pickupWindows, deliveryWindows, leadTime, leadTimeCutoff],
  );

  const { tax, estimatedTotal, taxLabel } = useMemo(() => {
    const taxAmount = Math.round(calcTax(subtotal, cookProvince) * 100) / 100;
    return {
      tax: taxAmount,
      estimatedTotal: Math.round((subtotal + taxAmount) * 100) / 100,
      taxLabel: getTaxLabel(cookProvince),
    };
  }, [subtotal, cookProvince]);

  if (items.length === 0) {
    return (
      <div className={styles.emptyPage}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconWrap} aria-hidden>
            <ShoppingCart size={28} strokeWidth={1.75} />
          </div>
          <p className={styles.emptyEyebrow}>Cart</p>
          <h1 className={styles.emptyTitle}>Your cart is empty</h1>
          <p className={styles.emptyDesc}>
            Browse meal prep services near you, add a few plates, and checkout
            when you&apos;re ready.
          </p>
          <Link href="/app/browse" className={styles.browseBtn}>
            Browse services
          </Link>
        </div>
      </div>
    );
  }

  const checkoutDisabled = !meetsMinimum || !withinMaximum;
  const remaining = Math.max(0, minOrderQty - totalQuantity);

  const checkoutButton = checkoutDisabled ? (
    <button type="button" className={styles.checkoutBtn} disabled aria-disabled>
      {!meetsMinimum ? `Add ${remaining} more to check out` : "Too many items"}
    </button>
  ) : (
    <Link href="/app/checkout" className={styles.checkoutBtn}>
      Proceed to checkout
    </Link>
  );

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <header className={styles.pageHead}>
            <p className={styles.pageEyebrow}>Cart</p>
            <h1 className={styles.pageTitle}>Your cart</h1>
            <p className={styles.pageSub}>
              {totalQuantity} item{totalQuantity === 1 ? "" : "s"}
            </p>
          </header>

          <section className={styles.orderCard} aria-label="Order items">
            {(fulfillmentLabel || cookName) && (
              <div className={styles.fulfillmentBanner}>
                {fulfillmentLabel ? (
                  <p className={styles.fulfillmentWhen}>
                    <CalendarClock size={16} aria-hidden />
                    {fulfillmentLabel}
                  </p>
                ) : (
                  <p className={styles.fulfillmentWhen}>
                    <CalendarClock size={16} aria-hidden />
                    {isDelivery ? "Delivery" : "Pickup"} windows not available
                    right now
                  </p>
                )}
                {cookName && (
                  <p className={styles.fulfillmentKitchen}>
                    {cookName}
                    <span className={styles.fulfillmentHint}>
                      {" "}
                      · Exact time confirmed by the cook
                    </span>
                  </p>
                )}
              </div>
            )}

            <ul className={styles.itemList}>
              {items.map((item) => (
                <li key={item.dishId} className={styles.itemRow}>
                  <span className={styles.itemQty} aria-hidden>
                    {item.quantity}
                  </span>
                  <div className={styles.itemBody}>
                    <div className={styles.itemMain}>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={styles.itemPrice}>
                        ${formatCartMoney(item.lineTotal)}
                      </span>
                    </div>
                    <div className={styles.itemMeta}>
                      {item.quantity > 1 && (
                        <span className={styles.itemUnit}>
                          ${formatCartMoney(item.price)} each
                        </span>
                      )}
                      {item.discountAmount > 0 && (
                        <span className={styles.itemDiscount}>
                          −${formatCartMoney(item.discountAmount)} promo
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeItem(item.dishId)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={14} aria-hidden />
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {notes && <NotePreview notes={notes} />}

            {!meetsMinimum && (
              <p className={styles.alert}>
                Add {remaining} more to reach the {minOrderQty}-item minimum.
              </p>
            )}
            {!withinMaximum && maxOrderQty != null && (
              <p className={styles.alert}>
                This kitchen allows up to {maxOrderQty} items per order (
                {totalQuantity}/{maxOrderQty}).
              </p>
            )}
          </section>

          <Link href={menuHref} className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden />
            Back to menu
          </Link>
        </div>

        <aside className={styles.rail} aria-label="Order summary">
          <div className={styles.railInner}>
            <section className={styles.summaryCard}>
              <h2 className={styles.summaryTitle}>Order summary</h2>

              <div className={styles.summaryLines}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>${formatCartMoney(subtotal)}</span>
                </div>
                {tax > 0 && (
                  <div className={styles.summaryRow}>
                    <span>{taxLabel}</span>
                    <span>${formatCartMoney(tax)}</span>
                  </div>
                )}
              </div>

              <PlatformDiscountSignupPrompt
                enabled={!platformDiscountEligible}
                subtotal={subtotal}
                className={styles.discountPrompt}
              />

              {isDelivery && (
                <p className={styles.deliveryHint}>
                  Delivery fee is calculated at checkout based on your address.
                </p>
              )}

              <div className={styles.summaryTotal}>
                <span>{isDelivery ? "Estimated total" : "Total"}</span>
                <span>${formatCartMoney(estimatedTotal)}</span>
              </div>

              {checkoutButton}
            </section>
          </div>
        </aside>
      </div>

      <div className={styles.mobileCartDock}>
        <div className={styles.mobileCartMain}>
          <div className={styles.mobileCartTotal}>
            <span className={styles.mobileCartQty}>
              {totalQuantity} item{totalQuantity === 1 ? "" : "s"}
            </span>
            <span className={styles.mobileCartAmount}>
              ${formatCartMoney(estimatedTotal)}
            </span>
          </div>
          {checkoutButton}
        </div>
        <Link href={menuHref} className={styles.mobileBackLink}>
          <ArrowLeft size={15} aria-hidden />
          Back to menu
        </Link>
      </div>
    </div>
  );
}
