"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CLIENT_PREFERENCE_QUESTIONS,
  type ClientPreferences,
  clearOnboardingStorage,
  EMPTY_CLIENT_PREFERENCES,
  isClientPreferencesComplete,
  readOnboardingStorage,
  togglePreference,
  writeOnboardingStorage,
} from "@/lib/client-preferences";
import { isAtLeast16 } from "@/lib/onboarding-validation";
import {
  formatPhoneDisplay,
  isValidNorthAmericanPhone,
  phoneDigits,
} from "@/lib/phone";
import styles from "./page.module.css";

type Step = 1 | 2;
type PhonePhase = "idle" | "code_sent" | "verified";

function PrefOption({
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
      className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className={styles.optionLabel}>{label}</span>
      <span className={styles.optionMark} aria-hidden="true">
        {selected && <Check size={11} strokeWidth={3} />}
      </span>
    </button>
  );
}

function PhoneStep({
  initialPhone,
  initialVerified,
  initialDob,
  onComplete,
}: {
  initialPhone: string;
  initialVerified: boolean;
  initialDob: string;
  onComplete: (phone: string, dob: string) => void;
}) {
  const [dob, setDob] = useState(initialDob);
  const [ageError, setAgeError] = useState("");
  const [phone, setPhone] = useState(() => phoneDigits(initialPhone));
  const [phase, setPhase] = useState<PhonePhase>(
    initialVerified ? "verified" : "idle",
  );
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [sendError, setSendError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [continueError, setContinueError] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const dobValid = dob.length > 0 && isAtLeast16(dob);
  const canSend =
    isValidNorthAmericanPhone(phone) && dobValid && phase !== "verified";
  const isVerified = phase === "verified";

  async function handleSend() {
    if (!dob) {
      setAgeError("Enter your date of birth to continue.");
      return;
    }
    if (!isAtLeast16(dob)) {
      setAgeError("You must be at least 16 years old to use 7eats.");
      return;
    }

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
      toast.success("Verification code sent by text.");
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

  async function handleContinue() {
    if (!dob) {
      setAgeError("Enter your date of birth to continue.");
      return;
    }
    if (!isAtLeast16(dob)) {
      setAgeError("You must be at least 16 years old to use 7eats.");
      return;
    }
    if (!isVerified) return;

    setContinuing(true);
    setContinueError("");
    try {
      const res = await fetch("/api/auth/client/save-dob", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dateOfBirth: dob }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContinueError(data.error ?? "Could not save your date of birth.");
        return;
      }
      onComplete(phone, dob);
    } catch {
      setContinueError("Network error. Please try again.");
    } finally {
      setContinuing(false);
    }
  }

  return (
    <div className={styles.stepContent}>
      <header className={styles.stepHeader}>
        <p className={styles.stepTag}>Step 1 of 2</p>
        <h1 className={styles.stepHeading}>
          Confirm your <span className={styles.accent}>age & phone</span>
        </h1>
        <p className={styles.stepDesc}>
          Enter your date of birth, then verify your mobile number with a
          one-time text code.
        </p>
      </header>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="dob">
            Date of birth
          </label>
          <input
            id="dob"
            type="date"
            className={styles.input}
            max={todayStr}
            value={dob}
            onChange={(e) => {
              setDob(e.target.value);
              setAgeError("");
            }}
          />
          <p className={styles.hint}>You must be 16 or older to use 7eats.</p>
          {ageError && <p className={styles.fieldError}>{ageError}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="onboarding-phone">
            Mobile number
          </label>
          <input
            id="onboarding-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className={styles.input}
            placeholder="(416) 555-0100"
            value={formatPhoneDisplay(phone)}
            onChange={(e) => {
              setPhone(phoneDigits(e.target.value));
              if (phase !== "idle" && phase !== "verified") {
                setPhase("idle");
                setCode("");
                setSendError("");
              }
            }}
            disabled={isVerified}
          />
        </div>

        {isVerified ? (
          <p className={styles.verifiedNote}>
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
            Phone verified
          </p>
        ) : (
          <button
            type="button"
            className={`btn btn-primary ${styles.actionBtn}`}
            onClick={() => void handleSend()}
            disabled={!canSend || sending}
            aria-disabled={!canSend || sending}
          >
            {sending
              ? "Sending…"
              : phase === "code_sent"
                ? "Resend code"
                : "Send code"}
          </button>
        )}

        {sendError && <p className={styles.fieldError}>{sendError}</p>}

        {phase === "code_sent" && !isVerified && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="otp-code">
                Verification code
              </label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                className={styles.otpInput}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setCodeError("");
                }}
              />
            </div>
            <button
              type="button"
              className={`btn btn-primary ${styles.actionBtn}`}
              onClick={() => void handleVerify()}
              disabled={code.length !== 6 || verifying}
              aria-disabled={code.length !== 6 || verifying}
            >
              {verifying ? "Verifying…" : "Verify"}
            </button>
          </>
        )}
        {codeError && <p className={styles.fieldError}>{codeError}</p>}
        {continueError && <p className={styles.fieldError}>{continueError}</p>}

        {isVerified && (
          <button
            type="button"
            className={`btn btn-primary ${styles.actionBtn}`}
            disabled={continuing}
            onClick={() => void handleContinue()}
          >
            {continuing ? "Saving…" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}

function PrefsStep({
  dob,
  onComplete,
}: {
  dob: string;
  onComplete: () => void;
}) {
  const [prefs, setPrefs] = useState<ClientPreferences>(
    EMPTY_CLIENT_PREFERENCES,
  );
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const prefsComplete = useMemo(
    () => isClientPreferencesComplete(prefs),
    [prefs],
  );

  async function handleSubmit() {
    if (!prefsComplete) return;
    setIsPending(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...prefs,
          dateOfBirth: dob,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong.");
        return;
      }
      clearOnboardingStorage();
      onComplete();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className={styles.stepContent}>
      <header className={styles.stepHeader}>
        <p className={styles.stepTag}>Step 2 of 2</p>
        <h1 className={styles.stepHeading}>
          Set your <span className={styles.accent}>preferences</span>
        </h1>
        <p className={styles.stepDesc}>
          Pick at least one option in each section so cooks know how to serve
          you safely. You can update these anytime in settings.
        </p>
      </header>

      <div className={styles.prefSections}>
        {CLIENT_PREFERENCE_QUESTIONS.map((question) => {
          const selected = prefs[question.id];
          return (
            <section key={question.id} className={styles.prefGroup}>
              <div className={styles.prefHeader}>
                <p className={styles.prefLabel}>{question.question}</p>
                {question.multiSelect && (
                  <p className={styles.prefHint}>Pick any that apply</p>
                )}
              </div>
              <div
                className={
                  question.id === "whyMealPrep"
                    ? styles.optionGridWide
                    : styles.optionGrid
                }
              >
                {question.options.map((option) => (
                  <PrefOption
                    key={option}
                    label={option}
                    selected={selected.includes(option)}
                    onToggle={() =>
                      setPrefs((current) =>
                        togglePreference(
                          current,
                          question.id,
                          option,
                          question.multiSelect,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {submitError && <p className={styles.fieldError}>{submitError}</p>}

      <button
        type="button"
        className={`btn btn-primary ${styles.actionBtn}`}
        onClick={() => void handleSubmit()}
        disabled={isPending || !prefsComplete}
        aria-disabled={isPending || !prefsComplete}
      >
        {isPending ? "Saving…" : "Finish"}
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  const [dob, setDob] = useState("");
  const [initialPhone, setInitialPhone] = useState("");
  const [initialVerified, setInitialVerified] = useState(false);

  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((r) => r.json())
      .then((data) => {
        const user = data?.user;
        if (!user) {
          router.replace("/app-auth/login");
          return;
        }

        const stored = readOnboardingStorage();
        const resolvedDob = user.dateOfBirth ?? stored?.dob ?? "";
        const phoneVerified = user.phoneVerified ?? false;

        setDob(resolvedDob);
        setInitialPhone(user.phone ?? stored?.phone ?? "");
        setInitialVerified(phoneVerified);

        if (phoneVerified && resolvedDob) {
          setStep(2);
        } else {
          setStep(1);
        }
      })
      .catch(() => setStep(1));
  }, [router]);

  function handlePhoneComplete(phone: string, collectedDob: string) {
    setDob(collectedDob);
    writeOnboardingStorage({ step: 2, phone, dob: collectedDob });
    setStep(2);
  }

  function handlePrefsComplete() {
    router.push("/app/browse");
  }

  if (step === null) return null;

  const progress = step === 1 ? 50 : 100;

  return (
    <div className={styles.page} data-auth-shell>
      <div className={styles.topBar}>
        <Image
          src="/7eats-logo.svg"
          alt="7eats"
          width={68}
          height={38}
          priority
        />
        <span className={styles.topBarStep}>Step {step} of 2</span>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className={styles.content}>
        {step === 1 && (
          <PhoneStep
            initialPhone={initialPhone}
            initialVerified={initialVerified}
            initialDob={dob}
            onComplete={handlePhoneComplete}
          />
        )}
        {step === 2 && <PrefsStep dob={dob} onComplete={handlePrefsComplete} />}
      </div>
    </div>
  );
}
