"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitApplication } from "./actions";
import styles from "./page.module.css";

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

const KITCHEN_TYPES = [
  { value: "licensed_home", label: "Licensed home kitchen" },
  { value: "commercial_rented", label: "Commercial kitchen (rented)" },
  { value: "ghost_kitchen", label: "Ghost kitchen" },
  { value: "restaurant_cafe", label: "Restaurant / café" },
  { value: "community_kitchen", label: "Community kitchen" },
  { value: "other", label: "Other" },
];

const YEARS_OPERATING = [
  "Less than 1 year",
  "1-2 years",
  "3-5 years",
  "6-10 years",
  "10+ years",
];

const ROLES = [
  "Owner",
  "Co-owner",
  "Head Chef / Cook",
  "Manager",
  "Operations Lead",
  "Other",
];

type FormState = {
  kitchenName: string;
  kitchenType: string;
  yearsOperating: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  website: string;
  businessPhone: string;
  businessEmail: string;
  contactFirstName: string;
  contactLastName: string;
  role: string;
  phone: string;
  email: string;
};

export default function ApplicationPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    kitchenName: "",
    kitchenType: "",
    yearsOperating: "",
    streetAddress: "",
    city: "",
    province: "",
    postalCode: "",
    website: "",
    businessPhone: "",
    businessEmail: "",
    contactFirstName: "",
    contactLastName: "",
    role: "",
    phone: "",
    email: "",
  });

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitApplication(form);
      if (result?.error) setError(result.error);
    });
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

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="kitchenType" className={styles.label}>
                      Kitchen type
                    </label>
                    <div className={styles.selectWrap}>
                      <select
                        id="kitchenType"
                        className={styles.select}
                        value={form.kitchenType}
                        onChange={(e) => set("kitchenType", e.target.value)}
                        required
                      >
                        <option value="">Select a type</option>
                        {KITCHEN_TYPES.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="yearsOperating" className={styles.label}>
                      Years operating
                    </label>
                    <div className={styles.selectWrap}>
                      <select
                        id="yearsOperating"
                        className={styles.select}
                        value={form.yearsOperating}
                        onChange={(e) => set("yearsOperating", e.target.value)}
                        required
                      >
                        <option value="">Select a range</option>
                        {YEARS_OPERATING.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="streetAddress" className={styles.label}>
                    Street address
                  </label>
                  <input
                    id="streetAddress"
                    className={styles.input}
                    type="text"
                    value={form.streetAddress}
                    onChange={(e) => set("streetAddress", e.target.value)}
                    placeholder="123 Main St, Unit 4"
                    autoComplete="address-line1"
                    required
                  />
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="city" className={styles.label}>
                      City
                    </label>
                    <input
                      id="city"
                      className={styles.input}
                      type="text"
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                      placeholder="Toronto"
                      autoComplete="address-level2"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="province" className={styles.label}>
                      Province
                    </label>
                    <div className={styles.selectWrap}>
                      <select
                        id="province"
                        className={styles.select}
                        value={form.province}
                        onChange={(e) => set("province", e.target.value)}
                        required
                      >
                        <option value="">Select a province</option>
                        {PROVINCES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="postalCode" className={styles.label}>
                    Postal code
                  </label>
                  <input
                    id="postalCode"
                    className={styles.input}
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value)}
                    placeholder="M5V 2T6"
                    autoComplete="postal-code"
                    required
                  />
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
                    <label htmlFor="contactFirstName" className={styles.label}>
                      First name
                    </label>
                    <input
                      id="contactFirstName"
                      className={styles.input}
                      type="text"
                      value={form.contactFirstName}
                      onChange={(e) => set("contactFirstName", e.target.value)}
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="contactLastName" className={styles.label}>
                      Last name
                    </label>
                    <input
                      id="contactLastName"
                      className={styles.input}
                      type="text"
                      value={form.contactLastName}
                      onChange={(e) => set("contactLastName", e.target.value)}
                      placeholder="Smith"
                      required
                    />
                  </div>
                </div>

                <div className={styles.fieldRow}>
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

                {error && <p className={styles.errorMsg}>{error}</p>}
                <button
                  type="submit"
                  className={`btn btn-primary ${styles.ctaBtn}`}
                  disabled={isPending}
                >
                  {isPending ? "Submitting…" : "Submit application"}
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
