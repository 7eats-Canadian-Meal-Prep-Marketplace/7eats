"use client";

import {
  CalendarClock,
  MapPin,
  Minus,
  NotebookPen,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  cancelByDate,
  formatLeadTime,
  LEAD_TIME_DAYS_MAP,
} from "@/lib/refund-policy";
import { buildCartItem, useCart } from "../../../_cart-context";
import { Skeleton } from "../../../_skeleton";
import styles from "./page.module.css";

// ── Pickup-slot generation ───────────────────────────────────────────────────
const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
const DAY_SHORT: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};
const SLOT_INTERVAL_MIN = 30;
const PICKUP_DAYS_AHEAD = 14;

type Window = { dayOfWeek: string; fromTime: string; toTime: string };

function generateSlots(
  windows: Window[],
  leadTime: string | null,
  now: Date,
): { iso: string; label: string }[] {
  if (windows.length === 0) return [];
  const leadDays = leadTime ? (LEAD_TIME_DAYS_MAP[leadTime] ?? 0) : 0;
  const byDay = new Map(windows.map((w) => [w.dayOfWeek, w]));
  const slots: { iso: string; label: string }[] = [];
  for (let d = 0; d < PICKUP_DAYS_AHEAD; d++) {
    if (d < leadDays) continue;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const win = byDay.get(DAY_NAMES[day.getDay()]);
    if (!win) continue;
    const [fh, fm] = win.fromTime.split(":").map(Number);
    const [th, tm] = win.toTime.split(":").map(Number);
    const start = new Date(day);
    start.setHours(fh, fm, 0, 0);
    const end = new Date(day);
    end.setHours(th, tm, 0, 0);
    for (
      let t = start;
      t < end;
      t = new Date(t.getTime() + SLOT_INTERVAL_MIN * 60_000)
    ) {
      if (t <= now) continue;
      slots.push({ iso: t.toISOString(), label: "" });
    }
  }
  return slots;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour}${period}`
    : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

/** Compact, ordered window summary, e.g. "Tue, Thu, Sat · 11am–2pm". */
function summarizeWindows(windows: Window[]): string {
  if (windows.length === 0) return "";
  const ordered = [...windows].sort(
    (a, b) =>
      DAY_NAMES.indexOf(a.dayOfWeek as (typeof DAY_NAMES)[number]) -
      DAY_NAMES.indexOf(b.dayOfWeek as (typeof DAY_NAMES)[number]),
  );
  const days = ordered.map((w) => DAY_SHORT[w.dayOfWeek] ?? w.dayOfWeek);
  const uniform = ordered.every(
    (w) => w.fromTime === ordered[0].fromTime && w.toTime === ordered[0].toTime,
  );
  const range = uniform
    ? `${fmtTime(ordered[0].fromTime)}–${fmtTime(ordered[0].toTime)}`
    : "varies by day";
  return `${days.join(", ")} · ${range}`;
}

// ── Types ────────────────────────────────────────────────────────────────────
type Promotion = {
  id: string;
  type: "percentage_off" | "fixed_off";
  value: string;
};

type Nutrition = {
  calories: number | null;
  proteinG: string | null;
  carbsG: string | null;
  fatG: string | null;
  fiberG: string | null;
  sugarG: string | null;
  sodiumMg: string | null;
};

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  cuisine: string | null;
  servingSize: string | null;
  dietary: string[];
  photos: { url: string; sortOrder: number }[];
  tags: { slug: string; label: string }[];
  ingredients: { name: string; isAllergen: boolean }[];
  nutrition: Nutrition | null;
  promotion: Promotion | null;
};

type MenuData = {
  cook: {
    id: string;
    displayName: string | null;
    cookName: string | null;
    photoUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    minOrderQty: number;
    maxOrderQty: number | null;
    leadTime: string | null;
    offersPickup: boolean;
    delivery: "none" | "self" | null;
    cancellationAllowed: boolean;
    acceptsSpecialRequests: boolean;
    pickupCity: string | null;
    pickupProvince: string | null;
    pickupWindows: Window[];
    deliveryWindows: Window[];
  };
  dishes: Dish[];
};

// ── Price helpers ────────────────────────────────────────────────────────────
function promoLabel(p: Promotion): string {
  return p.type === "percentage_off"
    ? `${Number(p.value)}% off`
    : `$${Number(p.value)} off`;
}

function discounted(price: number, p: Promotion | null): number {
  if (!p) return price;
  const v = Number(p.value);
  const next = p.type === "percentage_off" ? price * (1 - v / 100) : price - v;
  return Math.max(0, Math.round(next * 100) / 100);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CookMenuPage() {
  const params = useParams<{ id: string }>();
  const cookId = params.id;
  const router = useRouter();
  const cart = useCart();

  const [data, setData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [openDish, setOpenDish] = useState<Dish | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  // A pending add from this cook while the cart still holds another cook's order.
  const [conflict, setConflict] = useState<{ dish: Dish; qty: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cooks/${cookId}/menu`)
      .then((r) => {
        if (r.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (cancelled || !json) return;
        setData(json.data ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cookId]);

  const qtyByDish = useMemo(() => {
    const map: Record<string, number> = {};
    if (cart.cookId === cookId) {
      for (const i of cart.items) map[i.dishId] = i.quantity;
    }
    return map;
  }, [cart.cookId, cart.items, cookId]);

  const canPickup = data?.cook.offersPickup !== false;
  const canDeliver = data?.cook.delivery === "self";

  const slots = useMemo(() => {
    if (!data) return [];
    const windows =
      cart.fulfillmentMode === "delivery"
        ? data.cook.deliveryWindows
        : data.cook.pickupWindows;
    return generateSlots(windows, data.cook.leadTime, new Date());
  }, [data, cart.fulfillmentMode]);

  // Default the fulfillment mode to whatever the cook actually offers.
  useEffect(() => {
    if (!data) return;
    if (canPickup && !canDeliver && cart.fulfillmentMode !== "pickup") {
      cart.setFulfillment("pickup");
    } else if (
      !canPickup &&
      canDeliver &&
      cart.fulfillmentMode !== "delivery"
    ) {
      cart.setFulfillment("delivery");
    }
  }, [data, canPickup, canDeliver, cart.fulfillmentMode, cart.setFulfillment]);

  function buildBase(dish: Dish, nextQty: number) {
    const promo = dish.promotion
      ? {
          id: dish.promotion.id,
          type: dish.promotion.type,
          value: Number(dish.promotion.value),
        }
      : null;
    const item = buildCartItem(
      { id: dish.id, name: dish.name, price: Number(dish.price) },
      Math.max(0, nextQty),
      promo,
    );
    return {
      cookId,
      cookName: data?.cook.displayName ?? "Cook",
      cookProvince: data?.cook.pickupProvince ?? "ON",
      minOrderQty: data?.cook.minOrderQty ?? 1,
      maxOrderQty: data?.cook.maxOrderQty ?? null,
      leadTime: data?.cook.leadTime ?? null,
      cancellationAllowed: data?.cook.cancellationAllowed ?? false,
      item,
    };
  }

  function changeQty(dish: Dish, nextQty: number) {
    if (!data) return;
    // Switching kitchens replaces the cart — confirm with a proper dialog first.
    if (cart.cookId && cart.cookId !== cookId && cart.items.length > 0) {
      setConflict({ dish, qty: nextQty });
      return;
    }
    cart.addItem(buildBase(dish, nextQty));
  }

  function confirmSwitch() {
    if (!conflict) return;
    cart.clearAndAdd(buildBase(conflict.dish, conflict.qty));
    setConflict(null);
  }

  if (loading) return <MenuSkeleton />;
  if (notFound || !data) {
    return (
      <div className={styles.state}>
        <p>This kitchen isn’t available right now.</p>
        <Link href="/app/browse" className={styles.backLink}>
          Browse other cooks
        </Link>
      </div>
    );
  }

  const { cook, dishes } = data;
  const kitchen = cook.displayName?.trim() || "Kitchen";
  const person = cook.cookName?.trim() ?? "";
  const showPerson =
    person !== "" && person.toLowerCase() !== kitchen.toLowerCase();
  const activeForThisCook = cart.cookId === cookId;
  const totalQty = activeForThisCook ? cart.totalQuantity : 0;
  const subtotal = activeForThisCook ? cart.subtotal : 0;
  const meetsMin = totalQty >= cook.minOrderQty;
  const remaining = cook.minOrderQty - totalQty;
  const noSlots = slots.length === 0;
  const isDelivery = cart.fulfillmentMode === "delivery";
  const windowSummary = summarizeWindows(
    isDelivery ? cook.deliveryWindows : cook.pickupWindows,
  );
  const cutoff = cancelByDate(slots[0]?.iso ?? null, cook.leadTime);

  // "Order by X to pick up on Y" — derived from the next open slot and lead time.
  const leadBanner = (() => {
    if (slots.length === 0) return null;
    const fulfill = new Date(slots[0].iso);
    const leadDays = cook.leadTime
      ? (LEAD_TIME_DAYS_MAP[cook.leadTime] ?? 0)
      : 0;
    const orderBy = new Date(fulfill);
    orderBy.setDate(orderBy.getDate() - leadDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orderByMidnight = new Date(orderBy);
    orderByMidnight.setHours(0, 0, 0, 0);
    const verb = isDelivery ? "get delivery" : "pick up";
    return {
      soon: orderByMidnight <= today,
      orderBy: fmtDay(orderBy),
      fulfill: fmtDay(fulfill),
      verb,
    };
  })();

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* Left — the menu */}
        <main className={styles.menuCol}>
          <header className={styles.menuHead}>
            <p className={styles.menuEyebrow}>Menu</p>
            <h1 className={styles.menuTitle}>{kitchen}</h1>
          </header>

          {leadBanner && (
            <div className={styles.leadBanner}>
              <CalendarClock size={16} className={styles.leadIcon} />
              <p>
                {leadBanner.soon ? (
                  <>
                    Order today to {leadBanner.verb} on{" "}
                    <strong>{leadBanner.fulfill}</strong>.
                  </>
                ) : (
                  <>
                    Order by <strong>{leadBanner.orderBy}</strong> to{" "}
                    {leadBanner.verb} on <strong>{leadBanner.fulfill}</strong>.
                  </>
                )}
              </p>
            </div>
          )}

          {dishes.length === 0 ? (
            <p className={styles.empty}>No dishes available yet.</p>
          ) : (
            <ul className={styles.dishGrid}>
              {dishes.map((dish) => {
                const qty = qtyByDish[dish.id] ?? 0;
                const price = Number(dish.price);
                const final = discounted(price, dish.promotion);
                return (
                  <li key={dish.id}>
                    <article className={styles.dishCard}>
                      <div className={styles.dishMedia}>
                        <button
                          type="button"
                          className={styles.dishPhotoBtn}
                          onClick={() => setOpenDish(dish)}
                          aria-label={`View ${dish.name}`}
                        >
                          {dish.photos[0] ? (
                            // biome-ignore lint/performance/noImgElement: dish photo
                            <img
                              src={dish.photos[0].url}
                              alt={dish.name}
                              className={styles.dishPhotoImg}
                            />
                          ) : (
                            <div className={styles.dishPhotoPlaceholder} />
                          )}
                        </button>
                        {dish.promotion && (
                          <span className={styles.promoBadge}>
                            {promoLabel(dish.promotion)}
                          </span>
                        )}
                        <div className={styles.dishControl}>
                          {qty > 0 ? (
                            <fieldset
                              className={styles.stepper}
                              aria-label={`Quantity for ${dish.name}`}
                            >
                              <button
                                type="button"
                                className={styles.stepBtn}
                                onClick={() => changeQty(dish, qty - 1)}
                                aria-label={`Remove one ${dish.name}`}
                              >
                                <Minus size={15} strokeWidth={2.5} />
                              </button>
                              <span className={styles.stepQty}>{qty}</span>
                              <button
                                type="button"
                                className={styles.stepBtn}
                                onClick={() => changeQty(dish, qty + 1)}
                                aria-label={`Add one ${dish.name}`}
                              >
                                <Plus size={15} strokeWidth={2.5} />
                              </button>
                            </fieldset>
                          ) : (
                            <button
                              type="button"
                              className={styles.addCircle}
                              onClick={() => changeQty(dish, 1)}
                              aria-label={`Add ${dish.name}`}
                            >
                              <Plus size={18} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.dishInfoBtn}
                        onClick={() => setOpenDish(dish)}
                      >
                        <div className={styles.dishTop}>
                          <h3 className={styles.dishName}>{dish.name}</h3>
                          <span className={styles.dishPrice}>
                            {dish.promotion && (
                              <span className={styles.priceWas}>
                                ${price.toFixed(2)}
                              </span>
                            )}
                            ${final.toFixed(2)}
                          </span>
                        </div>
                        {dish.description && (
                          <p className={styles.dishDesc}>{dish.description}</p>
                        )}
                        {dish.dietary.length > 0 && (
                          <div className={styles.pills}>
                            {dish.dietary.slice(0, 3).map((d) => (
                              <span key={d} className={styles.pill}>
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        {/* Right — sticky cook + bill */}
        <aside className={styles.rail}>
          <div className={styles.railInner}>
            <section className={styles.cookCard}>
              <div className={styles.cookBanner}>
                {cook.bannerUrl ? (
                  // biome-ignore lint/performance/noImgElement: banner
                  <img src={cook.bannerUrl} alt="" />
                ) : (
                  <div className={styles.cookBannerFallback} />
                )}
                <div className={styles.cookAvatar}>
                  {cook.photoUrl ? (
                    // biome-ignore lint/performance/noImgElement: avatar
                    <img src={cook.photoUrl} alt="" />
                  ) : (
                    <span>{kitchen.charAt(0)}</span>
                  )}
                </div>
              </div>

              <div className={styles.cookInfo}>
                <h2 className={styles.cookName}>{kitchen}</h2>
                {showPerson && <p className={styles.cookBy}>by {person}</p>}
                <div className={styles.cookMetaRow}>
                  {cook.pickupCity && (
                    <span className={styles.cookCity}>
                      <MapPin size={12} /> {cook.pickupCity}
                    </span>
                  )}
                  <Link
                    href={`/app/cooks/${cookId}`}
                    className={styles.profileLink}
                  >
                    View profile
                  </Link>
                </div>

                <dl className={styles.cookFacts}>
                  <div className={styles.fact}>
                    <dt>Min order</dt>
                    <dd>
                      {cook.minOrderQty}{" "}
                      {cook.minOrderQty === 1 ? "plate" : "plates"}
                    </dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>Max order</dt>
                    <dd>
                      {cook.maxOrderQty
                        ? `${cook.maxOrderQty} plates`
                        : "No limit"}
                    </dd>
                  </div>
                  {cook.leadTime && (
                    <div className={styles.fact}>
                      <dt>Order ahead</dt>
                      <dd>{formatLeadTime(cook.leadTime)}</dd>
                    </div>
                  )}
                  {windowSummary && (
                    <div className={styles.fact}>
                      <dt>{isDelivery ? "Delivery" : "Pickup"}</dt>
                      <dd>{windowSummary}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </section>

            <section className={styles.bill}>
              <h2 className={styles.billTitle}>Your order</h2>

              {totalQty === 0 ? (
                <p className={styles.billEmpty}>
                  Tap a dish to start your order.
                </p>
              ) : (
                <>
                  <ul className={styles.billItems}>
                    {cart.items.map((i) => (
                      <li key={i.dishId} className={styles.billItem}>
                        <span className={styles.billQty}>{i.quantity}</span>
                        <span className={styles.billItemName}>{i.name}</span>
                        <span className={styles.billItemPrice}>
                          ${i.lineTotal.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.billRow}>
                    <span>Subtotal</span>
                    <span className={styles.billSubtotal}>
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              {canPickup && canDeliver && (
                <fieldset className={styles.segmented} aria-label="Fulfillment">
                  <button
                    type="button"
                    className={`${styles.segment} ${cart.fulfillmentMode === "pickup" ? styles.segmentActive : ""}`}
                    onClick={() => cart.setFulfillment("pickup")}
                  >
                    Pickup
                  </button>
                  <button
                    type="button"
                    className={`${styles.segment} ${cart.fulfillmentMode === "delivery" ? styles.segmentActive : ""}`}
                    onClick={() => cart.setFulfillment("delivery")}
                  >
                    Delivery
                  </button>
                </fieldset>
              )}

              <p className={styles.policy}>
                {!cook.cancellationAllowed ? (
                  <>
                    All sales are final. No cancellations or{" "}
                    <strong>refunds</strong>.
                  </>
                ) : cutoff ? (
                  <>
                    Cancel for a <strong>full refund</strong> until{" "}
                    <strong>{fmtDateTime(cutoff)}</strong>. After that, the sale
                    is final.
                  </>
                ) : (
                  <>
                    Cancel for a <strong>full refund</strong> up until this
                    kitchen&apos;s lead time before{" "}
                    {isDelivery ? "delivery" : "pickup"}.
                  </>
                )}
              </p>

              {totalQty > 0 && !meetsMin && (
                <p className={styles.minNotice}>
                  Add {remaining} more to reach the {cook.minOrderQty}-plate
                  minimum.
                </p>
              )}
              {noSlots && (
                <p className={styles.minNotice}>
                  This kitchen has no {cart.fulfillmentMode} times open right
                  now.
                </p>
              )}

              {activeForThisCook &&
                cook.acceptsSpecialRequests &&
                (totalQty > 0 || cart.notes) && (
                  <div className={styles.note}>
                    {cart.notes ? (
                      <>
                        <div className={styles.noteHead}>
                          <span className={styles.noteLabel}>
                            <NotebookPen size={13} /> Note for the cook
                          </span>
                          <button
                            type="button"
                            className={styles.noteEdit}
                            onClick={() => setNoteOpen(true)}
                          >
                            Modify
                          </button>
                        </div>
                        <p className={styles.noteText}>{cart.notes}</p>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.noteAdd}
                        onClick={() => setNoteOpen(true)}
                      >
                        <NotebookPen size={15} />
                        Add a note for the cook
                      </button>
                    )}
                  </div>
                )}

              <button
                type="button"
                className={styles.checkoutBtn}
                disabled={!meetsMin || noSlots || totalQty === 0}
                onClick={() => router.push("/app/checkout")}
              >
                {noSlots
                  ? "Unavailable right now"
                  : totalQty === 0
                    ? "Add dishes to continue"
                    : !meetsMin
                      ? `Minimum ${cook.minOrderQty} plates`
                      : "Go to checkout"}
              </button>
            </section>
          </div>
        </aside>
      </div>

      {openDish && (
        <DishModal
          dish={openDish}
          qty={qtyByDish[openDish.id] ?? 0}
          onChangeQty={(n) => changeQty(openDish, n)}
          onClose={() => setOpenDish(null)}
        />
      )}

      {noteOpen && activeForThisCook && (totalQty > 0 || cart.notes) && (
        <NoteModal
          initial={cart.notes ?? ""}
          onSave={(text) => cart.setNotes(text.trim() ? text.trim() : null)}
          onClose={() => setNoteOpen(false)}
        />
      )}

      {conflict && (
        <SwitchCartDialog
          fromCook={cart.cookName ?? "another kitchen"}
          toCook={cook.displayName ?? "this kitchen"}
          onCancel={() => setConflict(null)}
          onConfirm={confirmSwitch}
        />
      )}
    </div>
  );
}

// ── Switch-kitchen confirmation ───────────────────────────────────────────────
function SwitchCartDialog({
  fromCook,
  toCook,
  onCancel,
  onConfirm,
}: {
  fromCook: string;
  toCook: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className={styles.modalOverlay}>
      <button
        type="button"
        className={styles.modalBackdrop}
        aria-label="Keep current cart"
        onClick={onCancel}
      />
      <div
        className={styles.confirmModal}
        role="alertdialog"
        aria-modal="true"
        aria-label="Start a new order"
      >
        <div className={styles.confirmHead}>
          <h2 className={styles.confirmTitle}>Start a new order?</h2>
          <button
            type="button"
            className={styles.confirmClose}
            onClick={onCancel}
            aria-label="Keep current cart"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <p className={styles.confirmText}>
          Ordering from <strong>{toCook}</strong> will clear your cart from{" "}
          <strong>{fromCook}</strong>.
        </p>
        <button
          type="button"
          className={styles.confirmDanger}
          onClick={onConfirm}
        >
          Start new order
        </button>
      </div>
    </div>
  );
}

// ── Dish detail modal ────────────────────────────────────────────────────────
function DishModal({
  dish,
  qty,
  onChangeQty,
  onClose,
}: {
  dish: Dish;
  qty: number;
  onChangeQty: (n: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const price = Number(dish.price);
  const final = discounted(price, dish.promotion);
  const allergens = dish.ingredients.filter((i) => i.isAllergen);

  const n = dish.nutrition;
  const nutrition = n
    ? ([
        ["Calories", n.calories != null ? `${n.calories}` : null],
        ["Protein", n.proteinG != null ? `${Number(n.proteinG)}g` : null],
        ["Carbs", n.carbsG != null ? `${Number(n.carbsG)}g` : null],
        ["Fat", n.fatG != null ? `${Number(n.fatG)}g` : null],
        ["Fiber", n.fiberG != null ? `${Number(n.fiberG)}g` : null],
        ["Sugar", n.sugarG != null ? `${Number(n.sugarG)}g` : null],
        ["Sodium", n.sodiumMg != null ? `${Number(n.sodiumMg)}mg` : null],
      ].filter(([, v]) => v !== null) as [string, string][])
    : [];

  return (
    <div className={styles.modalOverlay}>
      <button
        type="button"
        className={styles.modalBackdrop}
        aria-label="Close dish details"
        onClick={onClose}
      />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={dish.name}
      >
        <button
          type="button"
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className={styles.modalPhoto}>
          {dish.photos[0] ? (
            // biome-ignore lint/performance/noImgElement: dish photo
            <img src={dish.photos[0].url} alt={dish.name} />
          ) : (
            <div className={styles.dishPhotoPlaceholder} />
          )}
          {dish.promotion && (
            <span className={styles.promoBadge}>
              {promoLabel(dish.promotion)}
            </span>
          )}
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalHead}>
            <h2 className={styles.modalName}>{dish.name}</h2>
            <span className={styles.modalPrice}>
              {dish.promotion && (
                <span className={styles.priceWas}>${price.toFixed(2)}</span>
              )}
              ${final.toFixed(2)}
            </span>
          </div>

          {(dish.cuisine || dish.servingSize) && (
            <p className={styles.modalMeta}>
              {[dish.cuisine, dish.servingSize].filter(Boolean).join(" · ")}
            </p>
          )}

          {dish.description && (
            <p className={styles.modalDesc}>{dish.description}</p>
          )}

          {dish.dietary.length > 0 && (
            <div className={styles.pills}>
              {dish.dietary.map((d) => (
                <span key={d} className={styles.pill}>
                  {d}
                </span>
              ))}
            </div>
          )}

          {dish.ingredients.length > 0 && (
            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Ingredients</h3>
              <p className={styles.ingredients}>
                {dish.ingredients.map((i) => i.name).join(", ")}
              </p>
            </section>
          )}

          {allergens.length > 0 && (
            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>May contain</h3>
              <div className={styles.allergenList}>
                {allergens.map((a) => (
                  <span key={a.name} className={styles.allergenPill}>
                    {a.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {nutrition.length > 0 && (
            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>
                Nutrition
                {dish.servingSize ? ` · per ${dish.servingSize}` : ""}
              </h3>
              <div className={styles.nutritionStrip}>
                {nutrition.map(([label, value]) => (
                  <div key={label} className={styles.nutritionItem}>
                    <span className={styles.nutritionValue}>{value}</span>
                    <span className={styles.nutritionLabel}>{label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className={styles.modalFoot}>
          {qty > 0 ? (
            <div className={styles.modalFootRow}>
              <fieldset className={styles.stepperLg} aria-label="Quantity">
                <button
                  type="button"
                  className={styles.stepBtnLg}
                  onClick={() => onChangeQty(qty - 1)}
                  aria-label="Remove one"
                >
                  <Minus size={16} strokeWidth={2.5} />
                </button>
                <span className={styles.stepQtyLg}>{qty}</span>
                <button
                  type="button"
                  className={styles.stepBtnLg}
                  onClick={() => onChangeQty(qty + 1)}
                  aria-label="Add one"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </fieldset>
              <span className={styles.modalFootTotal}>
                ${(final * qty).toFixed(2)}
              </span>
            </div>
          ) : (
            <button
              type="button"
              className={styles.modalAddBtn}
              onClick={() => onChangeQty(1)}
            >
              <span>Add to order</span>
              <span>${final.toFixed(2)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Note modal ───────────────────────────────────────────────────────────────
const NOTE_MAX = 500;

function NoteModal({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay}>
      <button
        type="button"
        className={styles.modalBackdrop}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={styles.noteModal}
        role="dialog"
        aria-modal="true"
        aria-label="Note for the cook"
      >
        <div className={styles.noteModalHead}>
          <h2 className={styles.noteModalTitle}>Note for the cook</h2>
          <button
            type="button"
            className={styles.noteClose}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <p className={styles.noteModalSub}>
          Allergies, spice level, dietary questions — anything the cook should
          know. They’ll confirm with you if needed.
        </p>
        <textarea
          className={styles.noteTextarea}
          value={text}
          maxLength={NOTE_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. No peanuts, mild spice, swap rice for salad…"
        />
        <div className={styles.noteModalFoot}>
          <span className={styles.noteCount}>
            {text.length}/{NOTE_MAX}
          </span>
          <div className={styles.noteActions}>
            <button
              type="button"
              className={styles.noteCancel}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.noteSave}
              onClick={() => {
                onSave(text);
                onClose();
              }}
            >
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────
function MenuSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <main className={styles.menuCol}>
          <div className={styles.menuHead}>
            <Skeleton width={120} height={28} radius={6} />
          </div>
          <ul className={styles.dishGrid}>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={styles.dishCard}>
                <Skeleton height={150} radius={0} />
                <div style={{ padding: 14, display: "grid", gap: 8 }}>
                  <Skeleton width="70%" height={16} radius={6} />
                  <Skeleton width="90%" height={12} radius={6} />
                </div>
              </li>
            ))}
          </ul>
        </main>
        <aside className={styles.rail}>
          <div className={styles.railInner}>
            <Skeleton height={180} radius={14} />
            <Skeleton height={200} radius={14} />
          </div>
        </aside>
      </div>
    </div>
  );
}
