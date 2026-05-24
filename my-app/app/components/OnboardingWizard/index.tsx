"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import SetupSidebar from "@/app/components/SetupSidebar";
import styles from "./OnboardingWizard.module.css";

// ── Constants ─────────────────────────────────────────────────

const CUISINES = [
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
  "Other",
];

const NICHES = [
  "General meal prep",
  "High-protein / Gym",
  "Weight loss",
  "Bulking / Mass gain",
  "Family meals",
  "Breakfast / Brunch",
  "Office lunches",
  "Student-friendly",
  "Post-workout recovery",
  "Senior nutrition",
];

const DIETARY_TAGS = [
  "Halal",
  "Vegan",
  "Vegetarian",
  "Gluten-free",
  "Kosher",
  "Nut-free",
  "Dairy-free",
  "Low-carb / Keto",
  "High-protein",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEAD_TIME_OPTIONS = [
  { value: "same_day", label: "Same day" },
  { value: "1_day", label: "1 day before" },
  { value: "2_days", label: "2 days before" },
  { value: "3_days", label: "3 days before" },
  { value: "4_days", label: "4 days before" },
  { value: "5_days", label: "5 days before" },
];

const DELIVERY_OPTIONS = [
  { value: "none", label: "No delivery" },
  { value: "self", label: "I deliver myself" },
];

// ── State shape ────────────────────────────────────────────────

type FormState = {
  // Step 1
  displayName: string;
  photoFileName: string;
  bio: string;
  cuisines: string[];
  niches: string[];
  dietaryTags: string[];
  socialLink: string;
  // Step 2
  pickupAddress: string;
  pickupFrom: string;
  pickupTo: string;
  pickupDays: string[];
  leadTime: string;
  maxCapacity: string;
  delivery: string;
  acceptsSpecialRequests: boolean;
  // Step 3
  certIdNumber: string;
  certExpiry: string;
  certFullName: string;
  certPhotoFileName: string;
  // Step 4
  stripeConnected: boolean;
  tosAccepted: boolean;
};

const initialForm: FormState = {
  displayName: "Mama Olu's Kitchen",
  photoFileName: "",
  bio: "",
  cuisines: [],
  niches: [],
  dietaryTags: [],
  socialLink: "",
  pickupAddress: "241 Spadina Ave, Toronto, ON M5V 2T6",
  pickupFrom: "",
  pickupTo: "",
  pickupDays: [],
  leadTime: "",
  maxCapacity: "",
  delivery: "none",
  acceptsSpecialRequests: false,
  certIdNumber: "",
  certExpiry: "",
  certFullName: "",
  certPhotoFileName: "",
  stripeConnected: false,
  tosAccepted: false,
};

// ── Helpers ────────────────────────────────────────────────────

function toggleList(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
}

// ── Component ──────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = Number(searchParams.get("step") ?? "1");
  const step = rawStep >= 1 && rawStep <= 4 ? rawStep : 1;

  const [form, setForm] = useState<FormState>(initialForm);
  const [completed, setCompleted] = useState<number[]>([]);
  const [stepError, setStepError] = useState("");
  const certInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const markDone = () => setCompleted((prev) => [...new Set([...prev, step])]);

  const validate = (): boolean => {
    if (step === 1) {
      if (!form.displayName.trim()) {
        setStepError("Display name is required.");
        return false;
      }
      if (form.bio.length < 100) {
        setStepError("Bio must be at least 100 characters.");
        return false;
      }
      if (form.cuisines.length === 0) {
        setStepError("Select at least one cuisine type.");
        return false;
      }
    }
    if (step === 2) {
      if (!form.pickupAddress.trim()) {
        setStepError("Pickup address is required.");
        return false;
      }
      if (!form.leadTime) {
        setStepError("Select an order lead time.");
        return false;
      }
    }
    if (step === 3) {
      if (!form.certIdNumber.trim()) {
        setStepError("Certificate ID number is required.");
        return false;
      }
      if (!form.certFullName.trim()) {
        setStepError("Full name on certificate is required.");
        return false;
      }
      if (!form.certExpiry) {
        setStepError("Certificate expiry date is required.");
        return false;
      }
    }
    if (step === 4) {
      if (!form.stripeConnected) {
        setStepError("Connect your Stripe account to continue.");
        return false;
      }
      if (!form.tosAccepted) {
        setStepError("Accept the terms of service to continue.");
        return false;
      }
    }
    return true;
  };

  const advance = () => {
    setStepError("");
    if (!validate()) return;
    markDone();

    if (step === 4) {
      // TODO: Server action — set setup_complete = true, then redirect to verify-phone
      // Skipping phone verification for now; redirecting directly to dashboard
      router.push("/business/dashboard");
    } else {
      router.push(`/business-auth/setup/onboarding?step=${step + 1}`);
    }
  };

  const goBack = () => {
    if (step === 1) {
      router.push("/business-auth/setup/verify-phone");
    } else {
      router.push(`/business-auth/setup/onboarding?step=${step - 1}`);
    }
  };

  return (
    <div className={styles.page}>
      <SetupSidebar
        activeStep={step + 2}
        completedSteps={[1, 2, ...completed.map((s) => s + 2)]}
      />

      {/* ── Right panel ── */}
      <main className={styles.right}>
        <div className={styles.rightInner}>
          {step === 1 && <Step1 form={form} set={set} />}
          {step === 2 && <Step2 form={form} set={set} />}
          {step === 3 && (
            <Step3
              form={form}
              set={set}
              certInputRef={certInputRef}
              onCompleteLater={() => router.push("/business/dashboard")}
            />
          )}
          {step === 4 && (
            <Step4
              form={form}
              set={set}
              onCompleteLater={() => router.push("/business/dashboard")}
            />
          )}

          {stepError && <p className={styles.stepError}>{stepError}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={`btn btn-primary ${styles.ctaBtn}`}
              onClick={advance}
            >
              {step === 4 ? "Complete setup" : "Save and continue"}
            </button>
            {step > 1 && (
              <button
                type="button"
                className={styles.laterBtn}
                onClick={goBack}
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Step sub-components ────────────────────────────────────────

function Step1({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const bioLen = form.bio.length;
  const bioOk = bioLen >= 100 && bioLen <= 500;

  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Step 3 of 6</p>
        <h2 className={styles.formTitle}>Cook profile</h2>
        <p className={styles.formSub}>
          This is what customers see when they browse your kitchen on 7eats.
        </p>
      </div>

      <div className={styles.fields}>
        {/* Display name */}
        <div className={styles.field}>
          <label htmlFor="displayName" className={styles.label}>
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            className={styles.input}
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="e.g. Mama Olu's Kitchen"
          />
          <p className={styles.hint}>
            What customers see. Edit if you want a different name than what you
            applied with.
          </p>
        </div>

        {/* Profile photo */}
        <div className={styles.field}>
          <span className={styles.label}>Profile photo</span>
          <div className={styles.photoWrap}>
            <div className={styles.photoPlaceholder}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className={styles.photoActions}>
              <input
                ref={photoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) set("photoFileName", file.name);
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => photoInputRef.current?.click()}
              >
                {form.photoFileName ? "Change photo" : "Upload photo"}
              </button>
              <p className={styles.photoNote}>
                {form.photoFileName
                  ? form.photoFileName
                  : "JPEG or PNG · min 400x400 · required"}
              </p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className={styles.field}>
          <label htmlFor="bio" className={styles.label}>
            Bio{" "}
            <span
              className={`${styles.charCount} ${bioOk ? styles.charCountOk : bioLen > 500 ? styles.charCountOver : ""}`}
            >
              {bioLen} / 500
            </span>
          </label>
          <textarea
            id="bio"
            className={styles.textarea}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Tell customers about your cooking. What you make, what makes it yours, where you learned. Minimum 100 characters."
            rows={5}
            maxLength={500}
          />
        </div>

        {/* Cuisine types */}
        <div className={styles.field}>
          <span className={styles.label}>Cuisine types</span>
          <div className={styles.pillGroup}>
            {CUISINES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("cuisines", toggleList(form.cuisines, c))}
                className={`${styles.pill} ${form.cuisines.includes(c) ? styles.pillActive : ""}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Niches */}
        <div className={styles.field}>
          <span className={styles.label}>
            Niche <span className={styles.labelNote}>(optional)</span>
          </span>
          <div className={styles.pillGroup}>
            {NICHES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set("niches", toggleList(form.niches ?? [], n))}
                className={`${styles.pill} ${(form.niches ?? []).includes(n) ? styles.pillActive : ""}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Dietary tags */}
        <div className={styles.field}>
          <span className={styles.label}>
            Dietary tags <span className={styles.labelNote}>(optional)</span>
          </span>
          <div className={styles.pillGroup}>
            {DIETARY_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  set("dietaryTags", toggleList(form.dietaryTags, t))
                }
                className={`${styles.pill} ${form.dietaryTags.includes(t) ? styles.pillActive : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Social link */}
        <div className={styles.field}>
          <label htmlFor="socialLink" className={styles.label}>
            Instagram or social link{" "}
            <span className={styles.labelNote}>(optional)</span>
          </label>
          <input
            id="socialLink"
            type="url"
            className={styles.input}
            value={form.socialLink}
            onChange={(e) => set("socialLink", e.target.value)}
            placeholder="instagram.com/yourkitchen"
          />
        </div>
      </div>
    </div>
  );
}

function Step2({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Step 4 of 6</p>
        <h2 className={styles.formTitle}>Operations</h2>
        <p className={styles.formSub}>
          How you run your kitchen day to day. Customers see your pickup window
          and prep schedule when browsing.
        </p>
      </div>

      <div className={styles.fields}>
        {/* Primary pickup address */}
        <div className={styles.field}>
          <label htmlFor="pickupAddress" className={styles.label}>
            Pickup address
          </label>
          <input
            id="pickupAddress"
            type="text"
            className={styles.input}
            value={form.pickupAddress}
            onChange={(e) => set("pickupAddress", e.target.value)}
            placeholder="Street address"
            autoComplete="street-address"
          />
          <p className={styles.hint}>
            Only revealed to customers after their order is confirmed.
          </p>
        </div>

        {/* Pickup days */}
        <div className={styles.field}>
          <span className={styles.label}>Pickup days</span>
          <div className={styles.pillGroup}>
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  set("pickupDays", toggleList(form.pickupDays, d))
                }
                className={`${styles.pill} ${form.pickupDays.includes(d) ? styles.pillActive : ""}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Pickup window */}
        <div className={styles.field}>
          <span className={styles.label}>Pickup window</span>
          <div className={styles.timeRow}>
            <div className={styles.timeField}>
              <label htmlFor="pickupFrom" className={styles.timeLabel}>
                From
              </label>
              <input
                id="pickupFrom"
                type="time"
                className={styles.input}
                value={form.pickupFrom}
                onChange={(e) => set("pickupFrom", e.target.value)}
              />
            </div>
            <span className={styles.timeSep}>—</span>
            <div className={styles.timeField}>
              <label htmlFor="pickupTo" className={styles.timeLabel}>
                To
              </label>
              <input
                id="pickupTo"
                type="time"
                className={styles.input}
                value={form.pickupTo}
                onChange={(e) => set("pickupTo", e.target.value)}
              />
            </div>
          </div>
          <p className={styles.hint}>
            Applied to all pickup days. Same hours every week.
          </p>
        </div>

        {/* Lead time */}
        <div className={styles.field}>
          <span className={styles.label}>Order lead time</span>
          <div className={styles.radioGroup}>
            {LEAD_TIME_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`${styles.radioCard} ${form.leadTime === value ? styles.radioCardActive : ""}`}
              >
                <input
                  type="radio"
                  name="leadTime"
                  value={value}
                  checked={form.leadTime === value}
                  onChange={() => set("leadTime", value)}
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>{label}</span>
              </label>
            ))}
          </div>
          <p className={styles.hint}>
            Customers ordering after this cutoff are booked for the next
            available pickup day. Cancellations before it receive a full refund,
            no refund after.
          </p>
        </div>

        {/* Max capacity */}
        <div className={styles.field}>
          <label htmlFor="maxCapacity" className={styles.label}>
            Max weekly order capacity
          </label>
          <input
            id="maxCapacity"
            type="number"
            min={5}
            max={500}
            className={styles.input}
            value={form.maxCapacity}
            onChange={(e) => set("maxCapacity", e.target.value)}
            placeholder="e.g. 250"
          />
          <p className={styles.hint}>
            We&apos;ll stop accepting new orders once this is reached.
          </p>
        </div>

        {/* Delivery */}
        <div className={styles.field}>
          <span className={styles.label}>Delivery</span>
          <div className={styles.radioGroup}>
            {DELIVERY_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`${styles.radioCard} ${form.delivery === value ? styles.radioCardActive : ""}`}
              >
                <input
                  type="radio"
                  name="delivery"
                  value={value}
                  checked={form.delivery === value}
                  onChange={() => set("delivery", value)}
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Special requests */}
        <div className={styles.field}>
          <span className={styles.label}>Special requests</span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.acceptsSpecialRequests}
              onChange={(e) => set("acceptsSpecialRequests", e.target.checked)}
            />
            <span className={styles.checkLabel}>
              I accept ingredient swaps and special requests from customers.
              They can add a note when ordering.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Step3({
  form,
  set,
  certInputRef,
  onCompleteLater,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  certInputRef: React.RefObject<HTMLInputElement | null>;
  onCompleteLater: () => void;
}) {
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) set("certPhotoFileName", file.name);
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <div className={styles.formHeadTop}>
          <p className={styles.formStep}>Step 5 of 6</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCompleteLater}
          >
            Complete later
          </button>
        </div>
        <h2 className={styles.formTitle}>Compliance</h2>
        <p className={styles.formSub}>
          Your food handler certificate details. Reviewed by our team before
          your menu goes live.
        </p>
      </div>

      <div className={styles.fields}>
        {/* Certificate ID */}
        <div className={styles.field}>
          <label htmlFor="certIdNumber" className={styles.label}>
            Certificate ID number
          </label>
          <input
            id="certIdNumber"
            type="text"
            className={styles.input}
            value={form.certIdNumber}
            onChange={(e) => set("certIdNumber", e.target.value)}
            placeholder="Found on your physical certificate"
          />
        </div>

        {/* Full name on certificate */}
        <div className={styles.field}>
          <label htmlFor="certFullName" className={styles.label}>
            Full name as it appears on the certificate
          </label>
          <input
            id="certFullName"
            type="text"
            className={styles.input}
            value={form.certFullName}
            onChange={(e) => set("certFullName", e.target.value)}
            placeholder="e.g. Oluwaseun Adeyemi"
          />
        </div>

        {/* Expiry date */}
        <div className={styles.field}>
          <label htmlFor="certExpiry" className={styles.label}>
            Expiry date
          </label>
          <input
            id="certExpiry"
            type="date"
            className={styles.input}
            value={form.certExpiry}
            onChange={(e) => set("certExpiry", e.target.value)}
            min={new Date().toISOString().split("T")[0]}
          />
          <p className={styles.hint}>We will remind you before it expires.</p>
        </div>

        {/* Optional photo */}
        <div className={styles.field}>
          <span className={styles.label}>
            Photo of certificate{" "}
            <span className={styles.labelNote}>(optional)</span>
          </span>
          <button
            type="button"
            className={`${styles.uploadZone} ${form.certPhotoFileName ? styles.uploadZoneHasFile : ""}`}
            onClick={() => certInputRef.current?.click()}
          >
            <input
              ref={certInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className={styles.uploadInput}
              onChange={handlePhotoChange}
              tabIndex={-1}
            />
            {form.certPhotoFileName ? (
              <>
                <span className={styles.uploadIcon}>✓</span>
                <p className={styles.uploadLabel}>{form.certPhotoFileName}</p>
                <p className={styles.uploadSub}>Click to replace</p>
              </>
            ) : (
              <>
                <span className={styles.uploadIcon}>
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </span>
                <p className={styles.uploadLabel}>Click to upload</p>
                <p className={styles.uploadSub}>JPEG, PNG or PDF · max 10 MB</p>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step4({
  form,
  set,
  onCompleteLater,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onCompleteLater: () => void;
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <div className={styles.formHeadTop}>
          <p className={styles.formStep}>Step 6 of 6</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCompleteLater}
          >
            Complete later
          </button>
        </div>
        <h2 className={styles.formTitle}>Get paid</h2>
        <p className={styles.formSub}>
          Connect your bank account and you are ready to receive your first
          order.
        </p>
      </div>

      <div className={styles.fields}>
        {/* Stripe Connect */}
        <div className={styles.field}>
          <span className={styles.label}>Payments</span>
          <div
            className={`${styles.stripeBox} ${form.stripeConnected ? styles.stripeConnected : ""}`}
          >
            <div className={styles.stripeBoxHeader}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={styles.stripeIcon}
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span className={styles.stripeBoxTitle}>Stripe Connect</span>
              {form.stripeConnected && (
                <span className={styles.stripeBadge}>Connected</span>
              )}
            </div>
            <p className={styles.stripeBoxSub}>
              7eats uses Stripe to deposit your earnings directly to your bank
              account. We never see your banking details.
            </p>
            {form.stripeConnected ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => set("stripeConnected", false)}
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  // TODO: Call server action to create Stripe Connect Express account,
                  // get onboarding URL, redirect to Stripe. On return check account status.
                  // Mocking as connected for now.
                  set("stripeConnected", true);
                }}
              >
                Connect with Stripe →
              </button>
            )}
          </div>
        </div>

        {/* Platform terms */}
        <div className={styles.field}>
          <span className={styles.label}>Platform terms</span>
          <div className={styles.termsList}>
            <div className={styles.termsItem}>
              <span className={styles.termsItemLabel}>Platform fee</span>
              <span className={styles.termsItemValue}>7.5% per order</span>
            </div>
            <div className={styles.termsItem}>
              <span className={styles.termsItemLabel}>Refunds</span>
              <span className={styles.termsItemValue}>
                Full refund before order cutoff
              </span>
            </div>
            <div className={styles.termsItem}>
              <span className={styles.termsItemLabel}>Payouts</span>
              <span className={styles.termsItemValue}>
                Direct deposit via Stripe
              </span>
            </div>
          </div>
        </div>

        {/* Terms of service */}
        <div className={styles.field}>
          <span className={styles.label}>Terms of service</span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.tosAccepted}
              onChange={(e) => set("tosAccepted", e.target.checked)}
            />
            <span className={styles.checkLabel}>
              I have read and agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.inlineLink}
              >
                7eats Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.inlineLink}
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
