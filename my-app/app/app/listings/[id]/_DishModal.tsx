"use client";

import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DietaryBadge, MockDish } from "../../_mock";
import styles from "./_DishModal.module.css";
import { DISH_DETAILS } from "./_dish-details";

const BADGE_LABEL: Record<DietaryBadge, string> = {
  halal: "Halal",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "nut-free": "Nut-free",
  kosher: "Kosher",
};

function dishImages(_dishId: string): string[] {
  return ["/placeholder.jpg", "/placeholder.jpg", "/placeholder.jpg"];
}

interface Props {
  dish: MockDish;
  quantity: number;
  onClose: () => void;
  onAdd: (dish: MockDish) => void;
  onDecrement: (dish: MockDish) => void;
}

export default function DishModal({
  dish,
  quantity,
  onClose,
  onAdd,
  onDecrement,
}: Props) {
  const [slide, setSlide] = useState(0);
  const backdropRef = useRef<HTMLDivElement>(null);
  const images = dishImages(dish.id);
  const detail = DISH_DETAILS[dish.id];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const prev = () => setSlide((s) => (s - 1 + images.length) % images.length);
  const next = () => setSlide((s) => (s + 1) % images.length);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss
    <div
      className={styles.backdrop}
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={dish.name}
      >
        {/* ── Close ───────────────────────────────────────────────────────── */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        {/* ── Carousel ────────────────────────────────────────────────────── */}
        <div className={styles.carousel}>
          <div
            className={styles.track}
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {images.map((src, i) => (
              // biome-ignore lint/performance/noImgElement: mock data, no next/image remote config
              <img
                key={`slide-${dish.id}-${i}`}
                src={src}
                alt={`${dish.name} — ${i + 1}`}
                className={styles.slide}
                width={800}
                height={600}
                loading={i === 0 ? "eager" : "lazy"}
              />
            ))}
          </div>

          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={prev}
            aria-label="Previous photo"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={next}
            aria-label="Next photo"
          >
            <ChevronRight size={18} />
          </button>

          <div className={styles.dots} role="tablist">
            {images.map((_, i) => (
              <button
                key={`dot-${dish.id}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === slide}
                className={`${styles.dot} ${i === slide ? styles.dotActive : ""}`}
                onClick={() => setSlide(i)}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className={styles.body}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerText}>
              <h2 className={styles.name}>{dish.name}</h2>
              <p className={styles.portion}>{dish.portionSize}</p>
            </div>
            <div className={styles.priceBlock}>
              <div className={styles.price}>${dish.price}</div>
            </div>
          </div>
          <p className={styles.desc}>{dish.description}</p>

          {/* Macros */}
          {detail?.macros && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Nutrition per serving</span>
              <div className={styles.macros}>
                {(
                  [
                    { key: "calories", label: "Cal", unit: "" },
                    { key: "protein", label: "Protein", unit: "g" },
                    { key: "carbs", label: "Carbs", unit: "g" },
                    { key: "fat", label: "Fat", unit: "g" },
                  ] as const
                ).map(({ key, label, unit }) => (
                  <div key={key} className={styles.macro}>
                    <span className={styles.macroVal}>
                      {detail.macros[key]}
                      {unit && (
                        <span className={styles.macroUnit}> {unit}</span>
                      )}
                    </span>
                    <span className={styles.macroLabel}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dietary */}
          {dish.badges.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Dietary</span>
              <div className={styles.badges}>
                {dish.badges.map((b) => (
                  <span key={b} className={styles.badge}>
                    {BADGE_LABEL[b]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Allergens */}
          {detail?.allergens && detail.allergens.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Contains</span>
              <div className={styles.badges}>
                {detail.allergens.map((a) => (
                  <span
                    key={a}
                    className={`${styles.badge} ${styles.badgeAllergen}`}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients */}
          {detail?.ingredients && detail.ingredients.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Ingredients</span>
              <p className={styles.ingredients}>
                {detail.ingredients.join(", ")}
              </p>
            </div>
          )}

          <div className={styles.ctaSpacer} />
        </div>

        {/* ── Sticky CTA ──────────────────────────────────────────────────── */}
        <div className={styles.cta}>
          {quantity === 0 ? (
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => onAdd(dish)}
            >
              Add to cart — ${dish.price}
            </button>
          ) : (
            <div className={styles.qtyRow}>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={() => onDecrement(dish)}
                aria-label="Remove one"
              >
                <Minus size={16} />
              </button>
              <span className={styles.qtyNum}>{quantity}</span>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={() => onAdd(dish)}
                aria-label="Add one more"
              >
                <Plus size={16} />
              </button>
              <span className={styles.qtyTotal}>
                ${dish.price * quantity}.00
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
