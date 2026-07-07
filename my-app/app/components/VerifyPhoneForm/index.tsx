"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import RequirementsChecklist from "@/app/components/RequirementsChecklist";
import styles from "./VerifyPhoneForm.module.css";

type Stage = "phone" | "code";

const PHONE_DIGITS = 10;

/** Keep only digits, dropping a leading "1" country code, capped at 10. */
function phoneDigits(value: string): string {
  let d = value.replace(/\D/g, "");
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

export default function VerifyPhoneForm({
  defaultPhone = "",
}: {
  defaultPhone?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState(() => phoneDigits(defaultPhone));
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone)) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/setup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setStage("code");
    });
  };

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/setup/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push(data.redirect);
    });
  };

  const resend = () => {
    setOtp("");
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/setup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
    });
  };

  if (stage === "code") {
    return (
      <form onSubmit={verifyCode}>
        <div className={styles.formHead}>
          <p className={styles.formStep}>Step 2 of 6</p>
          <h2 className={styles.formTitle}>Enter the code</h2>
          <p className={styles.formSub}>
            We sent a 6-digit code to <strong>{formatPhone(phone)}</strong>.
          </p>
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="otp" className={styles.label}>
              Verification code <span className={styles.requiredStar}>*</span>
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={styles.otpInput}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="000000"
              autoComplete="one-time-code"
            />
          </div>

          <RequirementsChecklist
            items={[
              {
                label: `6-digit code entered (${otp.length}/6)`,
                met: otp.length === 6,
              },
            ]}
            touched={otp.length > 0}
          />

          {error && (
            <p className={styles.fieldError} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={`btn btn-primary ${styles.ctaBtn} ${otp.length !== 6 ? styles.ctaBtnDisabled : ""}`}
            disabled={isPending}
            aria-disabled={otp.length !== 6}
          >
            {isPending ? "Verifying…" : "Verify"}
          </button>

          <div className={styles.secondaryActions}>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={isPending}
              onClick={resend}
            >
              Resend code
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={isPending}
              onClick={() => {
                setOtp("");
                setError("");
                setStage("phone");
              }}
            >
              Change number
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Step 2 of 6</p>
        <h2 className={styles.formTitle}>Verify your phone</h2>
        <p className={styles.formSub}>
          We'll send a one-time code to confirm your number. Required for
          account security and order notifications.
        </p>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="phone" className={styles.label}>
            Mobile number <span className={styles.requiredStar}>*</span>
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            className={styles.input}
            value={formatPhone(phone)}
            onChange={(e) => {
              setPhone(phoneDigits(e.target.value));
              setError("");
            }}
            placeholder="(416) 000-0000"
            autoComplete="tel"
          />
        </div>

        <RequirementsChecklist
          items={[
            {
              label: `Valid 10-digit phone number (${phone.length}/${PHONE_DIGITS})`,
              met: isValidPhone(phone),
            },
          ]}
          touched={phone.length > 0}
        />

        {error && (
          <p className={styles.fieldError} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className={`btn btn-primary ${styles.ctaBtn} ${!isValidPhone(phone) ? styles.ctaBtnDisabled : ""}`}
          disabled={isPending}
          aria-disabled={!isValidPhone(phone)}
        >
          {isPending ? "Sending…" : "Send code"}
        </button>
      </div>
    </form>
  );
}
