"use client";

import { ArrowLeft, Check, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "./page.module.css";

// ─── Available dishes (mock) ────────────────────────────────────────────────────

type AvailableDish = { id: string; name: string; cuisine: string };

const AVAILABLE_DISHES: AvailableDish[] = [
  { id: "d-1", name: "Jollof Rice & Chicken", cuisine: "West African" },
  { id: "d-2", name: "Beef Suya Skewers", cuisine: "West African" },
  { id: "d-3", name: "Vegetable Spring Rolls", cuisine: "Cantonese" },
  { id: "d-4", name: "Margherita Flatbread", cuisine: "Italian" },
  { id: "d-5", name: "Chicken Tikka Bowl", cuisine: "Indian" },
  { id: "d-6", name: "Falafel Wrap", cuisine: "Levantine" },
  { id: "d-7", name: "Miso Glazed Salmon", cuisine: "Japanese" },
];

type DealType = "percentage_off" | "fixed_off";

const DEAL_TYPE_LABELS: [DealType, string][] = [
  ["percentage_off", "% Off"],
  ["fixed_off", "$ Off"],
];

// ─── Steps ──────────────────────────────────────────────────────────────────────

const STEPS: { n: 1 | 2; label: string }[] = [
  { n: 1, label: "Listing details" },
  { n: 2, label: "Dishes & deal" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  basePrice: "",
  currency: "CAD",
  minOrderQty: "1",
  maxOrderQty: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewListingPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [created, setCreated] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [dealEnabled, setDealEnabled] = useState(false);
  const [dealType, setDealType] = useState<DealType>("percentage_off");
  const [dealValue, setDealValue] = useState("");

  function toggleDish(id: string) {
    setSelectedDishes((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  function resetAll() {
    setForm(EMPTY_FORM);
    setSelectedDishes([]);
    setDealEnabled(false);
    setDealType("percentage_off");
    setDealValue("");
    setStep(1);
  }

  function handleCreate() {
    setCreated(true);
    setTimeout(() => {
      setCreated(false);
      resetAll();
    }, 1600);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/business/listings" className={styles.back}>
          <ArrowLeft size={15} />
          Listings
        </Link>
        <h1 className={styles.title}>New listing</h1>
      </div>

      {/* Progress indicator */}
      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <div key={s.n} className={styles.stepWrap}>
            <div
              className={`${styles.step} ${step === s.n ? styles.stepActive : ""} ${
                step > s.n ? styles.stepDone : ""
              }`}
            >
              <span className={styles.stepNum}>
                {step > s.n ? <Check size={13} /> : s.n}
              </span>
              <span className={styles.stepLabel}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={styles.stepBar} />}
          </div>
        ))}
      </div>

      <div className={styles.content} key={step}>
        {step === 1 && (
          <form className={styles.form} onSubmit={handleStep1Submit}>
            <div className={styles.formGroup}>
              <label htmlFor="f-title" className={styles.formLabel}>
                Title
              </label>
              <input
                id="f-title"
                type="text"
                className={styles.formInput}
                value={form.title}
                placeholder="e.g. Weekend West African Feast"
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="f-description" className={styles.formLabel}>
                Description
              </label>
              <textarea
                id="f-description"
                className={styles.formTextarea}
                value={form.description}
                rows={4}
                placeholder="Describe what's included in this listing."
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="f-base-price" className={styles.formLabel}>
                  Base price
                </label>
                <div className={styles.priceWrap}>
                  <span className={styles.pricePre}>$</span>
                  <input
                    id="f-base-price"
                    type="text"
                    inputMode="decimal"
                    className={`${styles.formInput} ${styles.priceInput}`}
                    value={form.basePrice}
                    placeholder="0.00"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, basePrice: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="f-currency" className={styles.formLabel}>
                  Currency
                </label>
                <select
                  id="f-currency"
                  className={styles.formSelect}
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value }))
                  }
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="f-min-qty" className={styles.formLabel}>
                  Min order qty
                </label>
                <input
                  id="f-min-qty"
                  type="number"
                  min={1}
                  className={styles.formInput}
                  value={form.minOrderQty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minOrderQty: e.target.value }))
                  }
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="f-max-qty" className={styles.formLabel}>
                  Max order qty
                </label>
                <input
                  id="f-max-qty"
                  type="number"
                  min={1}
                  className={styles.formInput}
                  value={form.maxOrderQty}
                  placeholder="No max"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxOrderQty: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.saveBtn}>
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className={styles.step2}>
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Dishes</span>
                <span className={styles.sectionCount}>
                  {selectedDishes.length} selected
                </span>
              </div>
              <div className={styles.dishGrid}>
                {AVAILABLE_DISHES.map((dish) => {
                  const active = selectedDishes.includes(dish.id);
                  return (
                    <button
                      key={dish.id}
                      type="button"
                      className={`${styles.dishOption} ${active ? styles.dishOptionActive : ""}`}
                      onClick={() => toggleDish(dish.id)}
                      aria-pressed={active}
                    >
                      <span className={styles.dishCheck}>
                        {active ? <Check size={12} /> : <Plus size={12} />}
                      </span>
                      <span className={styles.dishOptionInfo}>
                        <span className={styles.dishOptionName}>
                          {dish.name}
                        </span>
                        <span className={styles.dishOptionCuisine}>
                          {dish.cuisine}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.dealToggleRow}>
                <div className={styles.dealToggleInfo}>
                  <span className={styles.sectionTitle}>Launch deal</span>
                  <span className={styles.dealToggleSub}>
                    Optionally add a discount to attract first orders.
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.toggleSwitch} ${dealEnabled ? styles.toggleSwitchOn : ""}`}
                  onClick={() => setDealEnabled((v) => !v)}
                  aria-label={dealEnabled ? "Remove deal" : "Add deal"}
                  aria-pressed={dealEnabled}
                >
                  <span className={styles.toggleKnob} />
                </button>
              </div>

              {dealEnabled && (
                <div className={styles.dealForm}>
                  <div className={styles.formGroup}>
                    <span className={styles.formLabel}>Type</span>
                    <div className={styles.segControl}>
                      {DEAL_TYPE_LABELS.map(([t, label]) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.segBtn} ${dealType === t ? styles.segBtnActive : ""}`}
                          onClick={() => setDealType(t)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="f-deal-value" className={styles.formLabel}>
                      {dealType === "percentage_off"
                        ? "Discount %"
                        : "Discount $"}
                    </label>
                    <input
                      id="f-deal-value"
                      type="number"
                      min={1}
                      max={dealType === "percentage_off" ? 100 : undefined}
                      className={styles.formInput}
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleCreate}
              >
                {created ? "Created!" : "Create listing"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setStep(1)}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
