"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { AddressSearchInput } from "@/components/AddressSearchInput";
import styles from "./page.module.css";

const LEGAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
  className: styles.consentLink,
} as const;

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

// Address fields (street/city/province/postal) are validated separately: they
// only count as filled when an address is picked from the Mapbox suggestions.
const STEP1_REQUIRED: { key: keyof FormState; label: string }[] = [
  { key: "kitchenName", label: "Kitchen name" },
  { key: "kitchenType", label: "Kitchen type" },
  { key: "yearsOperating", label: "Years operating" },
  { key: "businessPhone", label: "Business phone" },
  { key: "businessEmail", label: "Business email" },
];

const PHONE_DIGITS = 10;

/** Keep only digits, capped at a 10-digit North American number. */
function phoneDigits(value: string): string {
  let d = value.replace(/\D/g, "");
  // Drop a leading "+1" country code (e.g. a Google-autofilled "+1 416 555 0100")
  // so it doesn't eat one of the 10 real digits.
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, PHONE_DIGITS);
}

/** Display digits as "(416) 555-0100", formatting progressively as typed. */
function formatPhone(value: string): string {
  const d = phoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function isValidPhone(value: string): boolean {
  return phoneDigits(value).length === PHONE_DIGITS;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Website is optional; when present it must look like a URL (protocol optional). */
function isValidWebsite(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

export default function ApplicationPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [step1Attempted, setStep1Attempted] = useState(false);
  // True only once an address is selected from the Mapbox suggestions. Typed
  // text that isn't picked from the dropdown does not count.
  const [addressResolved, setAddressResolved] = useState(false);
  const [agreed, setAgreed] = useState(false);
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

  // Returns the first thing wrong with step 1, or null when it's valid.
  const step1Error = (): string | null => {
    for (const f of STEP1_REQUIRED) {
      if (!form[f.key].trim()) return `Please fill in: ${f.label}`;
    }
    if (!addressResolved) {
      return "Please select your address from the suggestions.";
    }
    if (!isValidPhone(form.businessPhone)) {
      return "Enter a valid 10-digit business phone number.";
    }
    if (!isValidEmail(form.businessEmail)) {
      return "Enter a valid business email address.";
    }
    if (!isValidWebsite(form.website)) {
      return "Enter a valid website URL (e.g. https://yoursite.com).";
    }
    return null;
  };

  // Returns the first thing wrong with step 2, or null when it's valid.
  const step2Error = (): string | null => {
    if (!form.contactFirstName.trim()) return "Please enter your first name.";
    if (!form.contactLastName.trim()) return "Please enter your last name.";
    if (!form.role.trim()) return "Please select your role.";
    if (!isValidPhone(form.phone)) {
      return "Enter a valid 10-digit phone number.";
    }
    if (!isValidEmail(form.email)) return "Enter a valid email address.";
    if (!agreed) {
      return "Please agree to the Cook Terms and related policies.";
    }
    return null;
  };

  const step1ErrorMsg = step1Error();
  const step1Complete = step1ErrorMsg === null;
  const step2Complete = step2Error() === null;

  const handleNext = () => {
    if (!step1Complete) {
      setStep1Attempted(true);
      return;
    }
    setStep1Attempted(false);
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = step2Error();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/business/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, acceptedTerms: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      window.location.href = data.redirect;
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
                  <label htmlFor="address-search" className={styles.label}>
                    Business address
                  </label>
                  <AddressSearchInput
                    id="address-search"
                    className={styles.input}
                    value={form.streetAddress}
                    onTextChange={(text) => {
                      // Manual typing clears any prior pick — only a selected
                      // suggestion is accepted.
                      setForm((f) => ({
                        ...f,
                        streetAddress: text,
                        city: "",
                        province: "",
                        postalCode: "",
                      }));
                      setAddressResolved(false);
                    }}
                    onResolve={(a) => {
                      setForm((f) => ({
                        ...f,
                        streetAddress: a.streetAddress,
                        city: a.city,
                        province: a.province,
                        postalCode: a.postalCode,
                      }));
                      setAddressResolved(true);
                    }}
                  />
                  {addressResolved ? (
                    <p className={styles.addressConfirm}>
                      {[
                        form.streetAddress,
                        form.city,
                        form.province,
                        form.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : (
                    <p className={styles.labelNote}>
                      Select your address from the suggestions.
                    </p>
                  )}
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
                      inputMode="numeric"
                      autoComplete="tel"
                      value={formatPhone(form.businessPhone)}
                      onChange={(e) =>
                        set("businessPhone", phoneDigits(e.target.value))
                      }
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

                {step1Attempted && step1ErrorMsg && (
                  <p className={styles.errorMsg}>{step1ErrorMsg}</p>
                )}
                <button
                  type="button"
                  className={`btn btn-primary ${styles.ctaBtn} ${!step1Complete ? styles.ctaBtnDisabled : ""}`}
                  onClick={handleNext}
                  aria-disabled={!step1Complete}
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
                    inputMode="numeric"
                    autoComplete="tel"
                    value={formatPhone(form.phone)}
                    onChange={(e) => set("phone", phoneDigits(e.target.value))}
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

                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    className={styles.consentCheckbox}
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span className={styles.consentText}>
                    I have read and agree to the{" "}
                    <Link href="/cook-terms" {...LEGAL_LINK_PROPS}>
                      Cook Terms
                    </Link>
                    ,{" "}
                    <Link href="/terms" {...LEGAL_LINK_PROPS}>
                      Terms of Service
                    </Link>
                    , and{" "}
                    <Link href="/privacy" {...LEGAL_LINK_PROPS}>
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {error && <p className={styles.errorMsg}>{error}</p>}
                <button
                  type="submit"
                  className={`btn btn-primary ${styles.ctaBtn} ${!step2Complete ? styles.ctaBtnDisabled : ""}`}
                  disabled={isPending}
                  aria-disabled={!step2Complete}
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
