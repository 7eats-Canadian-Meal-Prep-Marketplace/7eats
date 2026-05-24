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

const KITCHEN_TYPES = [
  { value: "home", label: "Home kitchen" },
  { value: "licensed_home", label: "Licensed home kitchen" },
  { value: "commercial", label: "Commercial kitchen" },
];

// ── State shape ────────────────────────────────────────────────

type FormState = {
  // Step 1
  displayName: string;
  bio: string;
  cuisines: string[];
  dietaryTags: string[];
  // Step 2
  pickupAddress: string;
  pickupFrom: string;
  pickupTo: string;
  prepDays: string[];
  maxCapacity: string;
  kitchenType: string;
  // Step 3
  certFileName: string;
  certExpiry: string;
  safetyDeclaration: boolean;
  // Step 4
  stripeConnected: boolean;
  commissionAck: boolean;
  tosAccepted: boolean;
};

const initialForm: FormState = {
  displayName: "",
  bio: "",
  cuisines: [],
  dietaryTags: [],
  pickupAddress: "",
  pickupFrom: "",
  pickupTo: "",
  prepDays: [],
  maxCapacity: "",
  kitchenType: "",
  certFileName: "",
  certExpiry: "",
  safetyDeclaration: false,
  stripeConnected: false,
  commissionAck: false,
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
      if (!form.kitchenType) {
        setStepError("Select a kitchen type.");
        return false;
      }
    }
    if (step === 3) {
      if (!form.certFileName) {
        setStepError("Please upload your food handler certificate.");
        return false;
      }
      if (!form.certExpiry) {
        setStepError("Certificate expiry date is required.");
        return false;
      }
      if (!form.safetyDeclaration) {
        setStepError("You must confirm the food safety declaration.");
        return false;
      }
    }
    if (step === 4) {
      if (!form.stripeConnected) {
        setStepError("Connect your Stripe account to continue.");
        return false;
      }
      if (!form.commissionAck) {
        setStepError("Acknowledge the commission rate to continue.");
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

  const saveForLater = () => {
    // TODO: Server action — persist current step state to DB
    router.push("/business-auth/setup/saved");
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
            <Step3 form={form} set={set} certInputRef={certInputRef} />
          )}
          {step === 4 && <Step4 form={form} set={set} />}

          {stepError && <p className={styles.stepError}>{stepError}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={`btn btn-primary ${styles.ctaBtn}`}
              onClick={advance}
            >
              {step === 4 ? "Complete setup" : "Save and continue"}
            </button>
            {step < 4 && (
              <button
                type="button"
                className={styles.laterBtn}
                onClick={saveForLater}
              >
                Save for later
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
              <button type="button" className="btn btn-ghost btn-sm">
                Upload photo
              </button>
              {/* TODO: Wire file input → content moderation → R2/Supabase upload */}
              <p className={styles.photoNote}>
                JPEG or PNG · min 400×400 · required
              </p>
            </div>
          </div>
        </div>

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
            What customers see. Can be your name or your kitchen name.
          </p>
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
            placeholder="Tell customers about your cooking — what you make, what makes it yours, where you learned. Minimum 100 characters."
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
        {/* Pickup address */}
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
            placeholder="Street address in Toronto"
            autoComplete="street-address"
          />
          <p className={styles.hint}>
            Only revealed to customers after their order is confirmed. Never
            shown publicly.
          </p>
          {/* TODO: Add Google Maps address autocomplete / postal code validation */}
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
        </div>

        {/* Prep days */}
        <div className={styles.field}>
          <span className={styles.label}>Prep days</span>
          <div className={styles.pillGroup}>
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("prepDays", toggleList(form.prepDays, d))}
                className={`${styles.pill} ${form.prepDays.includes(d) ? styles.pillActive : ""}`}
              >
                {d}
              </button>
            ))}
          </div>
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
            max={200}
            className={styles.input}
            value={form.maxCapacity}
            onChange={(e) => set("maxCapacity", e.target.value)}
            placeholder="e.g. 20"
          />
          <p className={styles.hint}>Between 5 and 200 orders per week.</p>
        </div>

        {/* Kitchen type */}
        <div className={styles.field}>
          <span className={styles.label}>Kitchen type</span>
          <div className={styles.radioGroup}>
            {KITCHEN_TYPES.map(({ value, label }) => (
              <label
                key={value}
                className={`${styles.radioCard} ${form.kitchenType === value ? styles.radioCardActive : ""}`}
              >
                <input
                  type="radio"
                  name="kitchenType"
                  value={value}
                  checked={form.kitchenType === value}
                  onChange={() => set("kitchenType", value)}
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>{label}</span>
              </label>
            ))}
          </div>
          <p className={styles.hint}>
            Affects which compliance documents are required in the next step.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step3({
  form,
  set,
  certInputRef,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  certInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const handleCertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      set("certFileName", file.name);
      // TODO: Validate file type (PDF/JPEG) and size (max 10MB) before upload
      // TODO: Upload to R2/Supabase, save URL + expiry to DB after content moderation
    }
  };

  const certLabel =
    form.kitchenType === "commercial"
      ? "Commercial kitchen license"
      : "Food handler certificate";

  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Step 5 of 6</p>
        <h2 className={styles.formTitle}>Compliance</h2>
        <p className={styles.formSub}>
          Required before your menu goes live. Documents are reviewed by our
          team and never shared publicly.
        </p>
      </div>

      <div className={styles.fields}>
        {/* Certificate upload */}
        <div className={styles.field}>
          <span className={styles.label}>{certLabel}</span>
          <button
            type="button"
            className={`${styles.uploadZone} ${form.certFileName ? styles.uploadZoneHasFile : ""}`}
            onClick={() => certInputRef.current?.click()}
          >
            <input
              ref={certInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg"
              className={styles.uploadInput}
              onChange={handleCertChange}
              tabIndex={-1}
            />
            {form.certFileName ? (
              <>
                <span className={styles.uploadIcon}>✓</span>
                <p className={styles.uploadLabel}>{form.certFileName}</p>
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
                <p className={styles.uploadSub}>PDF or JPEG · max 10 MB</p>
              </>
            )}
          </button>
        </div>

        {/* Expiry date */}
        <div className={styles.field}>
          <label htmlFor="certExpiry" className={styles.label}>
            Certificate expiry date
          </label>
          <input
            id="certExpiry"
            type="date"
            className={styles.input}
            value={form.certExpiry}
            onChange={(e) => set("certExpiry", e.target.value)}
            min={new Date().toISOString().split("T")[0]}
          />
          <p className={styles.hint}>
            Must be a future date. We'll remind you before it expires.
          </p>
        </div>

        {/* Safety declaration */}
        <div className={styles.field}>
          <span className={styles.label}>Food safety declaration</span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.safetyDeclaration}
              onChange={(e) => set("safetyDeclaration", e.target.checked)}
            />
            <span className={styles.checkLabel}>
              I prepare food in a clean kitchen, follow safe food handling
              practices, and will accurately disclose all allergens in my
              listings.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Step4({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Step 6 of 6</p>
        <h2 className={styles.formTitle}>Legal & payments</h2>
        <p className={styles.formSub}>
          The last step before you're live. Connect your bank account and
          confirm the terms.
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

        {/* Commission */}
        <div className={styles.field}>
          <span className={styles.label}>Commission rate</span>
          <div className={styles.infoCard}>
            <p className={styles.infoCardBody}>
              7eats charges a{" "}
              <strong className={styles.infoCardHighlight}>
                7.5% platform fee
              </strong>{" "}
              on each order. On a $40 order, that's $3 — you keep $37.
            </p>
          </div>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.commissionAck}
              onChange={(e) => set("commissionAck", e.target.checked)}
            />
            <span className={styles.checkLabel}>
              I understand and agree to the 7.5% platform commission on all
              orders processed through 7eats.
            </span>
          </label>
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
