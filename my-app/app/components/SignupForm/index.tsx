"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import styles from "./SignupForm.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.firstName.trim()) errors.firstName = "Required";
  else if (values.firstName.trim().length > 100) errors.firstName = "Too long";
  if (!values.lastName.trim()) errors.lastName = "Required";
  else if (values.lastName.trim().length > 100) errors.lastName = "Too long";
  if (!values.email.trim()) errors.email = "Required";
  else if (!EMAIL_RE.test(values.email.trim()))
    errors.email = "Enter a valid email";
  if (!values.password) errors.password = "Required";
  else if (values.password.length < 8)
    errors.password = "Use at least 8 characters";
  if (!values.confirmPassword) errors.confirmPassword = "Required";
  else if (values.confirmPassword !== values.password)
    errors.confirmPassword = "Passwords don't match";
  return errors;
}

export default function SignupForm({
  showLogo = true,
}: {
  showLogo?: boolean;
} = {}) {
  const [values, setValues] = useState<Values>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const set =
    (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setFormError("");
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    if (!agreed) {
      setFormError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setErrors({});
    setFormError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          password: values.password,
          acceptedTerms: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      window.location.href = data.redirect;
    });
  };

  const formContent = (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.sub}>Real home cooking, delivered to you.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="firstName" className={styles.label}>
              First name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              className={styles.input}
              value={values.firstName}
              onChange={set("firstName")}
              required
            />
            {errors.firstName && (
              <p className={styles.fieldError}>{errors.firstName}</p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="lastName" className={styles.label}>
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              className={styles.input}
              value={values.lastName}
              onChange={set("lastName")}
              required
            />
            {errors.lastName && (
              <p className={styles.fieldError}>{errors.lastName}</p>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={styles.input}
            value={values.email}
            onChange={set("email")}
            placeholder="you@example.com"
            required
          />
          {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <div className={styles.inputWrap}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={styles.input}
              value={values.password}
              onChange={set("password")}
              placeholder="8+ characters"
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className={styles.fieldError}>{errors.password}</p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Confirm password
          </label>
          <div className={styles.inputWrap}>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              className={styles.input}
              value={values.confirmPassword}
              onChange={set("confirmPassword")}
              placeholder="Re-enter your password"
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowConfirmPassword((s) => !s)}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className={styles.fieldError}>{errors.confirmPassword}</p>
          )}
        </div>

        <label className={styles.consent}>
          <input
            type="checkbox"
            className={styles.consentCheckbox}
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className={styles.consentText}>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className={styles.consentLink}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              className={styles.consentLink}
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {formError && <p className={styles.error}>{formError}</p>}

        <button
          type="submit"
          className={`btn btn-primary ${styles.submit}`}
          disabled={isPending || !agreed}
        >
          {isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className={styles.altAction}>
        Already have an account? <Link href="/app-auth/login">Sign in</Link>
      </p>
    </div>
  );

  if (showLogo) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <Link href="/app/browse" className={styles.logoLink}>
          <Image
            src="/7eats-logo.svg"
            alt="7eats"
            width={180}
            height={48}
            style={{ width: "auto" }}
            priority
          />
        </Link>
        <div className={styles.card}>{formContent}</div>
      </div>
    );
  }

  return formContent;
}
