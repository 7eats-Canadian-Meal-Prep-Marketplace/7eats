"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./page.module.css";

const CUISINE_TYPES = [
  "West African",
  "Caribbean",
  "South Asian",
  "East Asian",
  "Southeast Asian",
  "Middle Eastern",
  "Mediterranean",
  "Latin American",
  "East African",
  "Soul Food / Southern",
  "Canadian / North American",
  "Other",
];

const ROLES = [
  "Owner",
  "Co-owner",
  "Head Chef / Cook",
  "Manager",
  "Operations Lead",
  "Other",
];

const NICHES = [
  "General meal prep",
  "High-protein / Gym",
  "Weight loss / Low-calorie",
  "Halal",
  "Vegan / Plant-based",
  "Vegetarian",
  "Gluten-free",
  "Keto / Low-carb",
  "Breakfast / Brunch",
  "Family meals",
  "Kosher",
];

type FormState = {
  kitchenName: string;
  address: string;
  cuisine: string;
  niche: string;
  website: string;
  businessPhone: string;
  businessEmail: string;
  contactName: string;
  role: string;
  phone: string;
  email: string;
};

export default function ApplicationPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    kitchenName: "",
    address: "",
    cuisine: "",
    niche: "",
    website: "",
    businessPhone: "",
    businessEmail: "",
    contactName: "",
    role: "",
    phone: "",
    email: "",
  });

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire server action
    window.location.href = "/business/application-confirmation";
  };

  return (
    <div className={styles.page}>
      {/* ── Left panel ──────────────────────────────────────────── */}
      <aside className={styles.left}>
        <div className={styles.leftInner}>
          <div className={styles.leftTop}>
            <Link href="/business/home" className={styles.logo}>
              <Image
                src="/7eats-logo.svg"
                alt="7eats"
                width={96}
                height={26}
                style={{ width: "auto", filter: "brightness(0) invert(1)" }}
                priority
              />
            </Link>
          </div>

          <div className={styles.leftBody}>
            <span className={styles.leftEyebrow}>Join the platform</span>
            <h1 className={styles.leftHeadline}>Tell us about your kitchen.</h1>
            <p className={styles.leftSub}>
              We review every application personally and get back to you within
              48 hours.
            </p>
            <ul className={styles.trustList}>
              <li>Free to apply. No fees.</li>
              <li>You set your own prices.</li>
              <li>A real person follows up.</li>
            </ul>
          </div>
        </div>
      </aside>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <main className={styles.right}>
        <div className={styles.rightInner}>
          <div className={styles.dots}>
            <button
              type="button"
              aria-label="Step 1"
              className={`${styles.dot} ${step === 1 ? styles.dotActive : ""}`}
              onClick={() => setStep(1)}
            />
            <button
              type="button"
              aria-label="Step 2"
              className={`${styles.dot} ${step === 2 ? styles.dotActive : ""}`}
              onClick={() => step === 2 && setStep(2)}
            />
          </div>

          <div className={styles.formHead}>
            <p className={styles.formStep}>Step {step} of 2</p>
            <h2 className={styles.formTitle}>
              {step === 1 ? "Your business" : "Your contact"}
            </h2>
            <p className={styles.formSub}>
              {step === 1
                ? "Tell us how you operate so we can hit the ground running."
                : "Who do we connect with? This stays internal. Customers only see your kitchen name."}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div key="step1" className={styles.fields}>
                <div className={styles.field}>
                  <label htmlFor="kitchenName" className={styles.label}>
                    Kitchen or operating name
                  </label>
                  <input
                    id="kitchenName"
                    className={styles.input}
                    type="text"
                    value={form.kitchenName}
                    onChange={(e) => set("kitchenName", e.target.value)}
                    placeholder="e.g. Mama Olu's Kitchen"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="address" className={styles.label}>
                    Address
                  </label>
                  <input
                    id="address"
                    className={styles.input}
                    type="text"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="Start typing your address…"
                    autoComplete="street-address"
                    required
                  />
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="cuisine" className={styles.label}>
                      Cuisine
                    </label>
                    <div className={styles.selectWrap}>
                      <select
                        id="cuisine"
                        className={styles.select}
                        value={form.cuisine}
                        onChange={(e) => set("cuisine", e.target.value)}
                        required
                      >
                        <option value="">Select a cuisine</option>
                        {CUISINE_TYPES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="niche" className={styles.label}>
                      Niche
                    </label>
                    <div className={styles.selectWrap}>
                      <select
                        id="niche"
                        className={styles.select}
                        value={form.niche}
                        onChange={(e) => set("niche", e.target.value)}
                        required
                      >
                        <option value="">Select a niche</option>
                        {NICHES.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="website" className={styles.label}>
                    Website
                    <span className={styles.labelNote}> (optional)</span>
                  </label>
                  <input
                    id="website"
                    className={styles.input}
                    type="url"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://yoursite.com or instagram.com/…"
                  />
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="businessPhone" className={styles.label}>
                      Business phone
                    </label>
                    <input
                      id="businessPhone"
                      className={styles.input}
                      type="tel"
                      value={form.businessPhone}
                      onChange={(e) => set("businessPhone", e.target.value)}
                      placeholder="(416) 000-0000"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="businessEmail" className={styles.label}>
                      Business email
                    </label>
                    <input
                      id="businessEmail"
                      className={styles.input}
                      type="email"
                      value={form.businessEmail}
                      onChange={(e) => set("businessEmail", e.target.value)}
                      placeholder="orders@yourkitchen.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className={`btn btn-primary ${styles.ctaBtn}`}
                  onClick={() => setStep(2)}
                >
                  Next
                </button>
              </div>
            )}

            {step === 2 && (
              <div key="step2" className={styles.fields}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="contactName" className={styles.label}>
                      Full name
                    </label>
                    <input
                      id="contactName"
                      className={styles.input}
                      type="text"
                      value={form.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="role" className={styles.label}>
                      Role
                    </label>
                    <div className={styles.selectWrap}>
                      <select
                        id="role"
                        className={styles.select}
                        value={form.role}
                        onChange={(e) => set("role", e.target.value)}
                        required
                      >
                        <option value="">Select a role</option>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="phone" className={styles.label}>
                    Phone number
                  </label>
                  <input
                    id="phone"
                    className={styles.input}
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="(416) 000-0000"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>
                    Email address
                  </label>
                  <input
                    id="email"
                    className={styles.input}
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary ${styles.ctaBtn}`}
                >
                  Submit application
                </button>
                <button
                  type="button"
                  className={styles.backBtn}
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
