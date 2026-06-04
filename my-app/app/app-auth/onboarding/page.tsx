"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import styles from "./page.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const DIETARY_OPTIONS = [
  "Halal",
  "Vegan",
  "Vegetarian",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
  "Kosher",
];

const ALLERGY_OPTIONS = [
  "Tree nuts",
  "Peanuts",
  "Dairy",
  "Gluten",
  "Shellfish",
  "Eggs",
  "Soy",
  "None",
];

const GOAL_OPTIONS = [
  "High protein",
  "Weight loss",
  "Low carb",
  "Muscle gain",
  "Heart health",
  "Comfort food",
  "Family-friendly",
  "Balanced",
];

const WHY_OPTIONS = [
  "Save time cooking",
  "Eat healthier",
  "Budget-friendly eating",
  "Discover new cuisines",
  "Support local home cooks",
  "Convenient for my schedule",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2;
type PhonePhase = "idle" | "code_sent" | "verified";

type Prefs = {
  dietary: string[];
  allergies: string[];
  goals: string[];
  whyMealPrep: string[];
};

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${selected ? styles.chipSelected : ""}`}
      onClick={onToggle}
    >
      {selected && (
        <Check size={11} strokeWidth={3} className={styles.chipCheck} />
      )}
      {label}
    </button>
  );
}

// ─── Step 1: Phone ────────────────────────────────────────────────────────────

function PhoneStep({ onComplete }: { onComplete: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<PhonePhase>("idle");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendError, setSendError] = useState("");
  const [codeError, setCodeError] = useState("");

  const canSend = phone.replace(/\D/g, "").length >= 10;
  const isVerified = phase === "verified";

  async function handleSend() {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/auth/client/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Could not send code.");
        return;
      }
      setPhase("code_sent");
      setCode("");
      setCodeError("");
      toast.success("Code sent!");
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setCodeError("");
    try {
      const res = await fetch("/api/auth/client/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeError(data.error ?? "Incorrect code.");
        return;
      }
      setPhase("verified");
      toast.success("Phone verified!");
    } catch {
      setCodeError("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepTag}>Step 1 of 2</div>
      <h1 className={styles.stepHeading}>
        What's your <span className={styles.accent}>phone number?</span>
      </h1>
      <p className={styles.stepDesc}>
        For order updates and messages from your cooks. We'll send a quick
        verification code.
      </p>

      <div className={`${styles.panel} ${styles.phoneBlock}`}>
        <div className={styles.phoneRow}>
          <input
            type="tel"
            autoComplete="tel"
            className={`${styles.phoneInput} ${isVerified ? styles.phoneInputVerified : ""}`}
            placeholder="+1 (416) 555-0123"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phase !== "idle") {
                setPhase("idle");
                setCode("");
                setSendError("");
              }
            }}
            disabled={isVerified}
          />
          {!isVerified ? (
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!canSend || sending}
            >
              {sending
                ? "Sending…"
                : phase === "code_sent"
                  ? "Resend"
                  : "Send code"}
            </button>
          ) : (
            <span className={styles.verifiedBadge}>
              <Check size={13} strokeWidth={2.5} />
              Verified
            </span>
          )}
        </div>

        {sendError && <p className={styles.codeError}>{sendError}</p>}

        {phase === "code_sent" && (
          <div className={styles.codeRow}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={styles.codeInput}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setCodeError("");
              }}
            />
            <button
              type="button"
              className={styles.verifyBtn}
              onClick={handleVerify}
              disabled={code.length !== 6 || verifying}
            >
              {verifying ? "Verifying…" : "Verify"}
            </button>
          </div>
        )}
        {codeError && <p className={styles.codeError}>{codeError}</p>}
      </div>

      <button
        type="button"
        className={styles.nextBtn}
        disabled={!isVerified}
        onClick={() => onComplete(phone)}
      >
        Continue
      </button>
    </div>
  );
}

// ─── Step 2: Preferences ──────────────────────────────────────────────────────

function PrefsStep({ onComplete }: { onComplete: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>({
    dietary: [],
    allergies: [],
    goals: [],
    whyMealPrep: [],
  });
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function toggle(
    key: "dietary" | "allergies" | "goals" | "whyMealPrep",
    val: string,
  ) {
    setPrefs((p) => {
      if (key === "allergies") {
        const arr = p.allergies;
        if (val === "None") {
          return { ...p, allergies: arr.includes("None") ? [] : ["None"] };
        }
        const withoutNone = arr.filter((v) => v !== "None");
        return {
          ...p,
          allergies: withoutNone.includes(val)
            ? withoutNone.filter((v) => v !== val)
            : [...withoutNone, val],
        };
      }
      const arr = p[key];
      return {
        ...p,
        [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val],
      };
    });
  }

  async function handleSubmit() {
    setIsPending(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong.");
        return;
      }
      onComplete();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepTag}>Step 2 of 2</div>
      <h1 className={styles.stepHeading}>
        Personalize your <span className={styles.accent}>experience.</span>
      </h1>
      <p className={styles.stepDesc}>
        Help us show you the right cooks and meals. All optional — you can
        update this anytime in settings.
      </p>

      <div className={styles.prefSections}>
        <div className={styles.prefSection}>
          <p className={styles.prefLabel}>Dietary needs</p>
          <div className={styles.chips}>
            {DIETARY_OPTIONS.map((o) => (
              <Chip
                key={o}
                label={o}
                selected={prefs.dietary.includes(o)}
                onToggle={() => toggle("dietary", o)}
              />
            ))}
          </div>
        </div>

        <div className={styles.prefSection}>
          <p className={styles.prefLabel}>Allergies</p>
          <div className={styles.chips}>
            {ALLERGY_OPTIONS.map((o) => (
              <Chip
                key={o}
                label={o}
                selected={prefs.allergies.includes(o)}
                onToggle={() => toggle("allergies", o)}
              />
            ))}
          </div>
        </div>

        <div className={styles.prefSection}>
          <p className={styles.prefLabel}>Goals & preferences</p>
          <div className={styles.chips}>
            {GOAL_OPTIONS.map((o) => (
              <Chip
                key={o}
                label={o}
                selected={prefs.goals.includes(o)}
                onToggle={() => toggle("goals", o)}
              />
            ))}
          </div>
        </div>

        <div className={styles.prefSection}>
          <p className={styles.prefLabel}>Why do you order meal prep?</p>
          <div className={styles.whyGrid}>
            {WHY_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                className={`${styles.whyOption} ${prefs.whyMealPrep.includes(o) ? styles.whyOptionSelected : ""}`}
                onClick={() => toggle("whyMealPrep", o)}
              >
                {prefs.whyMealPrep.includes(o) && (
                  <Check
                    size={13}
                    strokeWidth={2.5}
                    className={styles.chipCheck}
                  />
                )}
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      {submitError && <p className={styles.codeError}>{submitError}</p>}

      <button
        type="button"
        className={styles.nextBtn}
        onClick={handleSubmit}
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Let's eat →"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);

  // Restore step from session — phoneVerified=true means phone step done.
  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((r) => r.json())
      .then((data) => {
        const phoneVerified = data?.user?.phoneVerified ?? false;
        setStep(phoneVerified ? 2 : 1);
      })
      .catch(() => setStep(1));
  }, []);

  function handlePhoneComplete(_phone: string) {
    setStep(2);
  }

  function handlePrefsComplete() {
    router.push("/app/browse");
  }

  // Avoid hydration mismatch — step determined client-side from session.
  if (step === null) return null;

  const progress = step === 1 ? 50 : 100;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Image
          src="/7eats-logo.svg"
          alt="7eats"
          width={68}
          height={38}
          priority
        />
        <nav className={styles.stepIndicator} aria-label={`Step ${step} of 2`}>
          <span
            className={step === 1 ? styles.stepDotActive : styles.stepDotDone}
          >
            1
          </span>
          <span
            className={`${styles.stepLine} ${step === 2 ? styles.stepLineDone : ""}`}
          />
          <span className={step === 2 ? styles.stepDotActive : styles.stepDot}>
            2
          </span>
        </nav>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className={styles.content}>
        {step === 1 && <PhoneStep onComplete={handlePhoneComplete} />}
        {step === 2 && <PrefsStep onComplete={handlePrefsComplete} />}
      </div>
    </div>
  );
}
