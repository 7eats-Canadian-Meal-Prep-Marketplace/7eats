"use client";

import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PREFERENCE_QUESTIONS } from "../../../app/app/_mock";
import styles from "./page.module.css";

type Step = 1 | 2 | 3;
type PrefAnswers = Record<string, string[]>;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    neighborhood: "",
  });
  const [prefAnswers, setPrefAnswers] = useState<PrefAnswers>({});

  const totalSteps = 3;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  const toggleAnswer = (qid: string, option: string, multi: boolean) => {
    setPrefAnswers((prev) => {
      const current = prev[qid] ?? [];
      if (multi) {
        if (current.includes(option)) {
          return { ...prev, [qid]: current.filter((o) => o !== option) };
        }
        return { ...prev, [qid]: [...current, option] };
      }
      return { ...prev, [qid]: [option] };
    });
  };

  const canAdvanceStep1 = form.firstName.trim() && form.lastName.trim();

  return (
    <div className={styles.page}>
      {/* Logo */}
      <div className={styles.topBar}>
        <Image
          src="/7eats-logo.svg"
          alt="7eats"
          width={68}
          height={38}
          priority
        />
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className={styles.content}>
        {/* Step 1: Name + location */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <div className={styles.stepTag}>Step 1 of {totalSteps}</div>
            <h1 className={styles.stepHeading}>
              Welcome to 7eats. <br />
              <span className={styles.accent}>Tell us about yourself.</span>
            </h1>
            <p className={styles.stepDesc}>
              This helps your cooks prepare your orders and greet you by name.
            </p>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="firstName">
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="Jane"
                  className={styles.input}
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, firstName: e.target.value }))
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="lastName">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  className={styles.input}
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, lastName: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="neighborhood">
                Your neighbourhood{" "}
                <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="neighborhood"
                type="text"
                placeholder="e.g. Roncesvalles, Kensington"
                className={styles.input}
                value={form.neighborhood}
                onChange={(e) =>
                  setForm((p) => ({ ...p, neighborhood: e.target.value }))
                }
              />
              <span className={styles.inputNote}>
                Helps us surface cooks closest to you.
              </span>
            </div>

            <button
              type="button"
              className={styles.nextBtn}
              onClick={() => setStep(2)}
              disabled={!canAdvanceStep1}
            >
              Continue
              <ArrowRight size={17} />
            </button>
          </div>
        )}

        {/* Step 2: Preference sheet */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <div className={styles.stepTag}>Step 2 of {totalSteps}</div>
            <h1 className={styles.stepHeading}>
              Your <span className={styles.accent}>preference sheet.</span>
            </h1>
            <p className={styles.stepDesc}>
              Cooks can see your answers before you even message them — no more
              explaining your diet every time you order. You can edit this
              anytime in settings.
            </p>

            <div className={styles.prefList}>
              {PREFERENCE_QUESTIONS.map((q) => {
                const answers = prefAnswers[q.id] ?? [];
                return (
                  <div key={q.id} className={styles.prefCard}>
                    <h3 className={styles.prefQuestion}>{q.question}</h3>
                    {q.multiSelect && (
                      <p className={styles.multiHint}>Select all that apply</p>
                    )}
                    <div className={styles.optionGrid}>
                      {q.options.map((opt) => {
                        const selected = answers.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`${styles.optionBtn} ${selected ? styles.optionBtnSelected : ""}`}
                            onClick={() =>
                              toggleAnswer(q.id, opt, q.multiSelect)
                            }
                          >
                            {selected && (
                              <Check size={13} className={styles.checkIcon} />
                            )}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.skipBtn}
                onClick={() => setStep(3)}
              >
                Skip for now
              </button>
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => setStep(3)}
              >
                Save & continue
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className={`${styles.stepContent} ${styles.doneStep}`}>
            <CheckCircle2
              size={64}
              strokeWidth={1.5}
              className={styles.doneIcon}
            />
            <h1 className={styles.stepHeading}>
              You&apos;re all set,{" "}
              <span className={styles.accent}>
                {form.firstName || "foodie"}!
              </span>
            </h1>
            <p className={styles.stepDesc}>
              Your account is ready. Start exploring home cooks near you — real
              food, made by real people.
            </p>

            <div className={styles.socialProof}>
              <div className={styles.proofAvatars}>
                {["AD", "JP", "FA", "MS", "NR"].map((init) => (
                  <div key={init} className={styles.proofAvatar}>
                    {init}
                  </div>
                ))}
              </div>
              <p className={styles.proofText}>
                Join <strong>2,000+</strong> food lovers discovering home cooks
                in Toronto
              </p>
            </div>

            <button
              type="button"
              className={styles.nextBtn}
              onClick={() => router.push("/app/browse")}
            >
              Browse listings →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
