"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ImageDropzone from "@/app/components/ImageDropzone";
import StripeConnectPanel from "@/app/components/StripeConnectPanel";
import {
  validateAccountSettings,
  validateKitchenSettings,
  validateOrderRules,
} from "@/lib/business-settings-validation";
import { useDirtyState } from "@/lib/forms/use-dirty";
import {
  formatPhoneDisplay,
  isValidNorthAmericanPhone,
  phoneDigits,
} from "@/lib/phone";
import { normalizeUrl } from "@/lib/url";
import { LogisticsSection } from "./_logistics-section";
import styles from "./page.module.css";

type SectionId =
  | "kitchen"
  | "logistics"
  | "account"
  | "billing"
  | "notifications"
  | "danger";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "kitchen", label: "Kitchen" },
  { id: "logistics", label: "Logistics" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Billing" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Danger Zone" },
];

// ─── Saved hook ────────────────────────────────────────────────────────────────

function useSaved() {
  const [saved, setSaved] = useState(false);
  function triggerSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  return { saved, triggerSaved };
}

// ─── Kitchen ───────────────────────────────────────────────────────────────────

type KitchenForm = {
  displayName: string;
  bio: string;
  photoUrl: string | null;
  bannerUrl: string | null;
  socialLink: string;
};

function KitchenSection() {
  const {
    value: form,
    setValue: setForm,
    load,
    markClean,
    dirty,
    markFilesDirty,
  } = useDirtyState<KitchenForm>({
    displayName: "",
    bio: "",
    photoUrl: null,
    bannerUrl: null,
    socialLink: "",
  });
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { saved, triggerSaved } = useSaved();
  const photoFileRef = useRef<File | null>(null);
  const bannerFileRef = useRef<File | null>(null);

  useEffect(() => {
    fetch("/api/business/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          load({
            displayName: json.data.displayName ?? "",
            bio: json.data.bio ?? "",
            photoUrl: json.data.photoUrl ?? null,
            bannerUrl: json.data.bannerUrl ?? null,
            socialLink: json.data.socialLink ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function handleSave() {
    setSaveError(null);

    const validationError = validateKitchenSettings(form);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    if (photoFileRef.current) {
      const fd = new FormData();
      fd.set("photo", photoFileRef.current);
      const uploadRes = await fetch("/api/business/profile/photo", {
        method: "POST",
        body: fd,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.success) {
        setSaveError(uploadJson.error ?? "Could not upload profile photo.");
        return;
      }
      setForm((f) => ({
        ...f,
        photoUrl: uploadJson.data.photoUrl ?? f.photoUrl,
      }));
      photoFileRef.current = null;
    }

    if (bannerFileRef.current) {
      const fd = new FormData();
      fd.set("banner", bannerFileRef.current);
      const uploadRes = await fetch("/api/business/profile/banner", {
        method: "POST",
        body: fd,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.success) {
        setSaveError(uploadJson.error ?? "Could not upload banner.");
        return;
      }
      setForm((f) => ({
        ...f,
        bannerUrl: uploadJson.data.bannerUrl ?? f.bannerUrl,
      }));
      bannerFileRef.current = null;
    }

    const res = await fetch("/api/business/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName.trim(),
        bio: form.bio.trim() || undefined,
        socialLink: normalizeUrl(form.socialLink),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaveError(json.error ?? "Could not save kitchen settings.");
      return;
    }
    markClean();
    triggerSaved();
  }

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardForm}>
          <span style={{ color: "var(--muted)" }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Profile photo</span>
          <ImageDropzone
            id="kitchen-profile-photo"
            variant="avatar"
            existingUrl={form.photoUrl}
            alt="Kitchen profile photo"
            onFile={(file) => {
              photoFileRef.current = file;
              markFilesDirty();
            }}
            note="JPG or PNG, max 4 MB"
          />
        </div>

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>
            Banner image{" "}
            <span className={styles.formLabelOptional}>(optional)</span>
          </span>
          <ImageDropzone
            id="kitchen-banner"
            variant="banner"
            existingUrl={form.bannerUrl}
            alt="Kitchen banner"
            onFile={(file) => {
              bannerFileRef.current = file;
              markFilesDirty();
            }}
            note="JPG or PNG, max 8 MB"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="s-bio" className={styles.formLabel}>
            Bio
          </label>
          <textarea
            id="s-bio"
            className={styles.formTextarea}
            rows={3}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="s-display-name" className={styles.formLabel}>
            Kitchen name
          </label>
          <input
            id="s-display-name"
            type="text"
            className={styles.formInput}
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="s-social" className={styles.formLabel}>
            Website <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input
            id="s-social"
            type="url"
            className={styles.formInput}
            value={form.socialLink}
            onChange={(e) =>
              setForm((f) => ({ ...f, socialLink: e.target.value }))
            }
          />
        </div>
      </div>

      {saveError && (
        <p
          style={{ color: "var(--red, #e23744)", padding: "0 1rem" }}
          role="alert"
        >
          {saveError}
        </p>
      )}

      <div className={styles.cardFooter}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!dirty}
        >
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Account ───────────────────────────────────────────────────────────────────

type AccountForm = {
  firstName: string;
  lastName: string;
  loginEmail: string;
};

function AccountSection() {
  const {
    value: form,
    setValue: setForm,
    load,
    markClean,
    dirty,
  } = useDirtyState<AccountForm>({
    firstName: "",
    lastName: "",
    loginEmail: "",
  });
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneChangeOpen, setPhoneChangeOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { saved, triggerSaved } = useSaved();

  function resetPhoneChange() {
    setPhoneChangeOpen(false);
    setPendingPhone("");
    setOtpCode("");
    setOtpSent(false);
    setPhoneError(null);
    setPhoneLoading(false);
  }

  useEffect(() => {
    fetch("/api/business/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          load({
            firstName: json.data.firstName ?? "",
            lastName: json.data.lastName ?? "",
            loginEmail: json.data.email ?? "",
          });
          setVerifiedPhone(formatPhoneDisplay(json.data.phone ?? ""));
          setPhoneVerified(Boolean(json.data.phoneVerified));
        }
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function handleSave() {
    setSaveError(null);

    const validationError = validateAccountSettings(form);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const res = await fetch("/api/business/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaveError(json.error ?? "Could not save account settings.");
      return;
    }
    markClean();
    triggerSaved();
  }

  async function sendPhoneCode() {
    setPhoneError(null);
    setPhoneSaved(false);

    if (!isValidNorthAmericanPhone(pendingPhone)) {
      setPhoneError("Enter a valid 10-digit phone number.");
      return;
    }
    if (
      verifiedPhone &&
      phoneDigits(pendingPhone) === phoneDigits(verifiedPhone)
    ) {
      setPhoneError("That is already your phone number.");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await fetch("/api/setup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits(pendingPhone) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhoneError(json.error ?? "Could not send verification code.");
        return;
      }
      setOtpSent(true);
      setOtpCode("");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function verifyPhoneCode() {
    setPhoneError(null);
    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setPhoneError("Enter the 6-digit code we sent you.");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await fetch("/api/business/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhoneError(json.error ?? "Verification failed.");
        return;
      }
      setVerifiedPhone(formatPhoneDisplay(json.data.phone ?? pendingPhone));
      setPhoneVerified(true);
      setPhoneSaved(true);
      resetPhoneChange();
      setTimeout(() => setPhoneSaved(false), 2500);
    } finally {
      setPhoneLoading(false);
    }
  }

  async function sendPasswordReset() {
    if (!form.loginEmail) return;
    setResetLoading(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.loginEmail }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveError(json.error ?? "Could not send reset email.");
        return;
      }
      setResetSent(true);
    } finally {
      setResetLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardForm}>
          <span style={{ color: "var(--muted)" }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="s-first" className={styles.formLabel}>
              First name
            </label>
            <input
              id="s-first"
              type="text"
              className={styles.formInput}
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="s-last" className={styles.formLabel}>
              Last name
            </label>
            <input
              id="s-last"
              type="text"
              className={styles.formInput}
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Phone</span>
            <input
              type="tel"
              className={styles.formInput}
              value={verifiedPhone || "Not set"}
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              style={{ opacity: 0.85, cursor: "default" }}
            />
            {!phoneChangeOpen ? (
              <div className={styles.phoneMetaRow}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setPhoneChangeOpen(true);
                    setPhoneError(null);
                    setPhoneSaved(false);
                  }}
                >
                  Change phone number
                </button>
                {verifiedPhone && phoneVerified && (
                  <span className={styles.phoneBadge}>Verified</span>
                )}
              </div>
            ) : (
              <div className={styles.phoneChangeBlock}>
                <label htmlFor="s-new-phone" className={styles.formLabel}>
                  New number
                </label>
                <input
                  id="s-new-phone"
                  type="tel"
                  className={styles.formInput}
                  value={pendingPhone}
                  onChange={(e) => {
                    setPendingPhone(formatPhoneDisplay(e.target.value));
                    setPhoneError(null);
                  }}
                  placeholder="(416) 555-0100"
                  disabled={otpSent || phoneLoading}
                  autoComplete="tel"
                />
                {!otpSent ? (
                  <div className={styles.phoneChangeActions}>
                    <button
                      type="button"
                      className={styles.outlineBtn}
                      onClick={sendPhoneCode}
                      disabled={phoneLoading}
                    >
                      {phoneLoading ? "Sending…" : "Send code"}
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={resetPhoneChange}
                      disabled={phoneLoading}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className={styles.phoneVerifyPanel}>
                    <p className={styles.formHint}>
                      Code sent to {formatPhoneDisplay(pendingPhone)}.
                    </p>
                    <label htmlFor="s-phone-otp" className={styles.formLabel}>
                      Verification code
                    </label>
                    <input
                      id="s-phone-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className={styles.formInput}
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        );
                        setPhoneError(null);
                      }}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      disabled={phoneLoading}
                    />
                    <div className={styles.phoneChangeActions}>
                      <button
                        type="button"
                        className={styles.outlineBtn}
                        onClick={verifyPhoneCode}
                        disabled={phoneLoading}
                      >
                        {phoneLoading ? "Verifying…" : "Verify and update"}
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={sendPhoneCode}
                        disabled={phoneLoading}
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={resetPhoneChange}
                        disabled={phoneLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {phoneError && (
                  <p className={styles.fieldError} role="alert">
                    {phoneError}
                  </p>
                )}
              </div>
            )}
            {phoneSaved && (
              <p className={styles.formHint}>Phone number updated.</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="s-login-email" className={styles.formLabel}>
              Login email
            </label>
            <input
              id="s-login-email"
              type="email"
              className={styles.formInput}
              value={form.loginEmail}
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              style={{ opacity: 0.7 }}
            />
          </div>
        </div>

        <div className={styles.formDivider} />

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Password</span>
          <p className={styles.notifDesc}>
            We will email you a secure link to set a new password.
          </p>
          <button
            type="button"
            className={styles.outlineBtn}
            onClick={sendPasswordReset}
            disabled={resetLoading || !form.loginEmail}
          >
            {resetLoading
              ? "Sending…"
              : resetSent
                ? "Reset email sent"
                : "Email password reset link"}
          </button>
        </div>

        {saveError && (
          <p style={{ color: "var(--red, #e23744)" }} role="alert">
            {saveError}
          </p>
        )}
      </div>

      <div className={styles.cardFooter}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!dirty}
        >
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Billing ───────────────────────────────────────────────────────────────────

function BillingSection() {
  const [platformFeePct, setPlatformFeePct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data.platformFeePct != null) {
          setPlatformFeePct(String(json.data.platformFeePct));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        {!loading && platformFeePct != null && (
          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Platform fee</span>
            <p className={styles.notifDesc}>
              {Number(platformFeePct)}% per order, deducted automatically at
              checkout.
            </p>
          </div>
        )}
        <StripeConnectPanel returnTo="/business/settings" />
      </div>
    </div>
  );
}

// ─── Notifications ─────────────────────────────────────────────────────────────

type NotifSettings = {
  emailNotificationsNewOrder: boolean;
  emailNotificationsNewReview: boolean;
  smsNotificationsNewOrder: boolean;
};

function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.toggleSwitch} ${on ? styles.toggleSwitchOn : ""}`}
      onClick={onToggle}
      aria-label={`${on ? "Disable" : "Enable"} ${label}`}
      aria-pressed={on}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

type OrderRulesForm = {
  minOrderQty: string;
  maxOrderQty: string;
  cancellationAllowed: boolean;
  acceptsSpecialRequests: boolean;
};

function OrderRulesSection() {
  const {
    value: form,
    setValue: setForm,
    load,
    markClean,
    dirty,
  } = useDirtyState<OrderRulesForm>({
    minOrderQty: "1",
    maxOrderQty: "",
    cancellationAllowed: false,
    acceptsSpecialRequests: false,
  });
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/dashboard/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          load({
            minOrderQty: String(json.data.minOrderQty ?? 1),
            maxOrderQty:
              json.data.maxOrderQty != null
                ? String(json.data.maxOrderQty)
                : "",
            cancellationAllowed: Boolean(json.data.cancellationAllowed),
            acceptsSpecialRequests: Boolean(json.data.acceptsSpecialRequests),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function save() {
    setError(null);
    setSavedMsg(null);

    const validationError = validateOrderRules({
      minOrderQty: form.minOrderQty,
      maxOrderQty: form.maxOrderQty,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const min = Number(form.minOrderQty);
    const max = form.maxOrderQty === "" ? null : Number(form.maxOrderQty);
    const res = await fetch("/api/business/dashboard/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minOrderQty: min,
        maxOrderQty: max,
        cancellationAllowed: form.cancellationAllowed,
        acceptsSpecialRequests: form.acceptsSpecialRequests,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save order rules.");
      return;
    }
    markClean();
    setSavedMsg("Saved");
    setTimeout(() => setSavedMsg(null), 2000);
  }

  if (loading) {
    return (
      <div className={styles.card}>
        <div style={{ padding: "1rem", color: "var(--muted)" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div
      className={styles.card}
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div className={styles.notifRow}>
        <div className={styles.notifInfo}>
          <span className={styles.notifLabel}>Minimum order quantity</span>
          <span className={styles.notifDesc}>
            Fewest items a customer must order.
          </span>
        </div>
        <input
          type="number"
          min="1"
          step="1"
          value={form.minOrderQty}
          onChange={(e) =>
            setForm((f) => ({ ...f, minOrderQty: e.target.value }))
          }
          style={{
            width: 90,
            padding: 8,
            borderRadius: 8,
            border: "1px solid var(--grey-300, #d1d5db)",
          }}
        />
      </div>

      <div className={styles.notifRow}>
        <div className={styles.notifInfo}>
          <span className={styles.notifLabel}>Maximum order quantity</span>
          <span className={styles.notifDesc}>Leave blank for none.</span>
        </div>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="None"
          value={form.maxOrderQty}
          onChange={(e) =>
            setForm((f) => ({ ...f, maxOrderQty: e.target.value }))
          }
          style={{
            width: 90,
            padding: 8,
            borderRadius: 8,
            border: "1px solid var(--grey-300, #d1d5db)",
          }}
        />
      </div>

      <div className={styles.notifRow}>
        <div className={styles.notifInfo}>
          <span className={styles.notifLabel}>Special requests</span>
          <span className={styles.notifDesc}>
            Let customers add notes to their orders.
          </span>
        </div>
        <Toggle
          on={form.acceptsSpecialRequests}
          onToggle={() =>
            setForm((f) => ({
              ...f,
              acceptsSpecialRequests: !f.acceptsSpecialRequests,
            }))
          }
          label="Special requests"
        />
      </div>

      <div className={styles.notifRow}>
        <div className={styles.notifInfo}>
          <span className={styles.notifLabel}>Allow cancellations</span>
          <span className={styles.notifDesc}>
            Let clients cancel before the lead date for a full refund.
          </span>
        </div>
        <Toggle
          on={form.cancellationAllowed}
          onToggle={() =>
            setForm((f) => ({
              ...f,
              cancellationAllowed: !f.cancellationAllowed,
            }))
          }
          label="Allow cancellations"
        />
      </div>

      {error && <p style={{ color: "var(--red, #e23744)" }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={save}
          disabled={!dirty}
        >
          Save order rules
        </button>
        {savedMsg && (
          <span style={{ color: "var(--green, #16a34a)" }}>{savedMsg}</span>
        )}
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/dashboard/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSettings({
            emailNotificationsNewOrder: json.data.emailNotificationsNewOrder,
            emailNotificationsNewReview: json.data.emailNotificationsNewReview,
            smsNotificationsNewOrder: json.data.smsNotificationsNewOrder,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: keyof NotifSettings) {
    if (!settings) return;
    const newValue = !settings[key];
    setSettings((prev) => (prev ? { ...prev, [key]: newValue } : prev));
    await fetch("/api/business/dashboard/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newValue }),
    });
  }

  const items = [
    {
      key: "emailNotificationsNewOrder" as const,
      label: "New orders (email)",
      description: "Get notified by email when a customer places an order.",
    },
    {
      key: "emailNotificationsNewReview" as const,
      label: "Reviews (email)",
      description: "Get notified by email when a customer leaves a review.",
    },
    {
      key: "smsNotificationsNewOrder" as const,
      label: "New orders (SMS)",
      description: "Get a text message when a customer places an order.",
    },
  ];

  return (
    <div className={styles.card}>
      {loading || !settings ? (
        <div style={{ padding: "1rem", color: "var(--muted)" }}>Loading…</div>
      ) : (
        items.map((item, i) => (
          <div
            key={item.key}
            className={i < items.length - 1 ? styles.notifRowBorder : ""}
          >
            <div className={styles.notifRow}>
              <div className={styles.notifInfo}>
                <span className={styles.notifLabel}>{item.label}</span>
                <span className={styles.notifDesc}>{item.description}</span>
              </div>
              <Toggle
                on={settings[item.key]}
                onToggle={() => toggle(item.key)}
                label={item.label}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Danger Zone ───────────────────────────────────────────────────────────────

function DangerSection() {
  return (
    <div className={`${styles.card} ${styles.dangerCard}`}>
      <div className={styles.dangerRow}>
        <div className={styles.dangerInfo}>
          <div className={styles.dangerTitle}>Delete account</div>
          <div className={styles.dangerDesc}>
            To permanently remove your kitchen and all associated data, contact
            support at{" "}
            <a href="mailto:contact@7eats.ca" className={styles.inlineLink}>
              contact@7eats.ca
            </a>
            . We will verify your identity before deleting anything.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("kitchen");

  const kitchenRef = useRef<HTMLDivElement>(null);
  const logisticsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const billingRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const dangerRef = useRef<HTMLDivElement>(null);
  const visibleIds = useRef(new Set<SectionId>());

  useEffect(() => {
    const ORDER: SectionId[] = [
      "kitchen",
      "logistics",
      "account",
      "billing",
      "notifications",
      "danger",
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id as SectionId;
          if (entry.isIntersecting) {
            visibleIds.current.add(id);
          } else {
            visibleIds.current.delete(id);
          }
        }
        for (const id of ORDER) {
          if (visibleIds.current.has(id)) {
            setActiveSection(id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );
    const refs = [
      kitchenRef,
      logisticsRef,
      accountRef,
      billingRef,
      notifRef,
      dangerRef,
    ];
    for (const ref of refs) {
      if (ref.current) observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: SectionId) {
    const refMap: Record<SectionId, React.RefObject<HTMLDivElement | null>> = {
      kitchen: kitchenRef,
      logistics: logisticsRef,
      account: accountRef,
      billing: billingRef,
      notifications: notifRef,
      danger: dangerRef,
    };
    refMap[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/business/dashboard" className={styles.back}>
          <ArrowLeft size={16} />
          Dashboard
        </Link>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.layout}>
        <div className={styles.sections}>
          <div id="kitchen" ref={kitchenRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Kitchen</h2>
            <KitchenSection />
          </div>

          <div id="logistics" ref={logisticsRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Logistics</h2>
            <LogisticsSection />
          </div>

          <div id="account" ref={accountRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Account</h2>
            <AccountSection />
          </div>

          <div id="billing" ref={billingRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Billing</h2>
            <BillingSection />
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Order rules</h2>
            <OrderRulesSection />
          </div>

          <div id="notifications" ref={notifRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Notifications</h2>
            <NotificationsSection />
          </div>

          <div id="danger" ref={dangerRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Danger Zone</h2>
            <DangerSection />
          </div>
        </div>

        <nav className={styles.sideNav} aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={`${styles.navItem} ${activeSection === s.id ? styles.navItemActive : ""}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
