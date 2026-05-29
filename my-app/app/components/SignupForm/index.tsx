"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import styles from "./SignupForm.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()-]{10,20}$/;

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
}

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
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
  // Phone is optional — only validate the format when something is entered.
  if (values.phone.trim() && !PHONE_RE.test(values.phone.trim()))
    errors.phone = "Enter a valid phone number";
  if (!values.password) errors.password = "Required";
  else if (values.password.length < 8)
    errors.password = "Use at least 8 characters";
  return errors;
}

export default function SignupForm() {
  const [values, setValues] = useState<Values>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

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
          phone: values.phone.trim() || undefined,
          password: values.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      // Hard navigation so the new session cookie is sent with the next request.
      window.location.href = data.redirect;
    });
  };

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.logoLink}>
        <Image
          src="/7eats-logo.svg"
          alt="7eats"
          width={180}
          height={48}
          style={{ width: "auto" }}
          priority
        />
      </Link>

      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.sub}>Real home cooking, delivered.</p>
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
            {errors.email && (
              <p className={styles.fieldError}>{errors.email}</p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="phone" className={styles.label}>
              Phone <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              className={styles.input}
              value={values.phone}
              onChange={set("phone")}
              placeholder="+1 (416) 555-0123"
            />
            {errors.phone && (
              <p className={styles.fieldError}>{errors.phone}</p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className={styles.input}
              value={values.password}
              onChange={set("password")}
              placeholder="8+ characters"
              required
            />
            {errors.password && (
              <p className={styles.fieldError}>{errors.password}</p>
            )}
          </div>

          {formError && <p className={styles.error}>{formError}</p>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.submit}`}
            disabled={isPending}
          >
            {isPending ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>

      <p className={styles.altAction}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
