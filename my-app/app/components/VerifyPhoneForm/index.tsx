"use client";

import { useState, useTransition } from "react";
import {
  sendOtp,
  verifyOtp,
} from "@/app/business-auth/setup/verify-phone/actions";
import styles from "./VerifyPhoneForm.module.css";

type Stage = "phone" | "code";

function isValidPhone(val: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(val.trim());
}

export default function VerifyPhoneForm({
  defaultPhone = "",
}: {
  defaultPhone?: string;
}) {
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState(defaultPhone);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone)) {
      setError("Enter a valid phone number.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await sendOtp(phone);
      if (result?.error) {
        setError(result.error);
      } else {
        setStage("code");
      }
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
      const result = await verifyOtp(otp);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const resend = () => {
    setOtp("");
    setError("");
    startTransition(async () => {
      const result = await sendOtp(phone);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  if (stage === "code") {
    return (
      <form onSubmit={verifyCode}>
        <div className={styles.formHead}>
          <p className={styles.formStep}>Step 2 of 6</p>
          <h2 className={styles.formTitle}>Enter the code</h2>
          <p className={styles.formSub}>
            We sent a 6-digit code to <strong>{phone}</strong>.
          </p>
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="otp" className={styles.label}>
              Verification code
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

          {error && <p className={styles.fieldError}>{error}</p>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.ctaBtn}`}
            disabled={isPending}
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
            Mobile number
          </label>
          <input
            id="phone"
            type="tel"
            className={styles.input}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
            placeholder="+1 (416) 000-0000"
            autoComplete="tel"
          />
        </div>

        {error && <p className={styles.fieldError}>{error}</p>}

        <button
          type="submit"
          className={`btn btn-primary ${styles.ctaBtn}`}
          disabled={isPending}
        >
          {isPending ? "Sending…" : "Send code"}
        </button>
      </div>
    </form>
  );
}
