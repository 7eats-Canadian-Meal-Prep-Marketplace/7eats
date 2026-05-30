"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  MOCK_NOTIFICATIONS,
  MOCK_PAYOUT_SETTINGS,
  MOCK_PROFILE,
  type MockNotification,
  type PayoutSchedule,
} from "./_mock";
import styles from "./page.module.css";

type Tab = "profile" | "notifications" | "payout";

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const [form, setForm] = useState(MOCK_PROFILE);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <label htmlFor="f-business-name" className={styles.formLabel}>
          Business name
        </label>
        <input
          id="f-business-name"
          type="text"
          className={styles.formInput}
          value={form.businessName}
          onChange={(e) =>
            setForm((f) => ({ ...f, businessName: e.target.value }))
          }
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="f-email" className={styles.formLabel}>
            Contact email
          </label>
          <input
            id="f-email"
            type="email"
            className={styles.formInput}
            value={form.contactEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, contactEmail: e.target.value }))
            }
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="f-phone" className={styles.formLabel}>
            Phone
          </label>
          <input
            id="f-phone"
            type="tel"
            className={styles.formInput}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="f-street" className={styles.formLabel}>
          Street address
        </label>
        <input
          id="f-street"
          type="text"
          className={styles.formInput}
          value={form.street}
          onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
        />
      </div>

      <div className={styles.formRow3}>
        <div className={styles.formGroup}>
          <label htmlFor="f-city" className={styles.formLabel}>
            City
          </label>
          <input
            id="f-city"
            type="text"
            className={styles.formInput}
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="f-province" className={styles.formLabel}>
            Province
          </label>
          <input
            id="f-province"
            type="text"
            className={styles.formInput}
            value={form.province}
            onChange={(e) =>
              setForm((f) => ({ ...f, province: e.target.value }))
            }
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="f-postal" className={styles.formLabel}>
            Postal code
          </label>
          <input
            id="f-postal"
            type="text"
            className={styles.formInput}
            value={form.postalCode}
            onChange={(e) =>
              setForm((f) => ({ ...f, postalCode: e.target.value }))
            }
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.saveBtn} onClick={handleSave}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Notifications tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const [items, setItems] = useState<MockNotification[]>(MOCK_NOTIFICATIONS);

  function toggle(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n)),
    );
  }

  return (
    <div className={styles.notifList}>
      {items.map((n) => (
        <div key={n.id} className={styles.notifRow}>
          <div className={styles.notifInfo}>
            <span className={styles.notifLabel}>{n.label}</span>
            <span className={styles.notifDesc}>{n.description}</span>
          </div>
          <button
            type="button"
            className={`${styles.toggleSwitch} ${n.enabled ? styles.toggleSwitchOn : ""}`}
            onClick={() => toggle(n.id)}
            aria-label={`${n.enabled ? "Disable" : "Enable"} ${n.label}`}
            aria-pressed={n.enabled}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Payout tab ───────────────────────────────────────────────────────────────

const SCHEDULES: { id: PayoutSchedule; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Biweekly" },
  { id: "monthly", label: "Monthly" },
];

function PayoutTab() {
  const [schedule, setSchedule] = useState<PayoutSchedule>(
    MOCK_PAYOUT_SETTINGS.schedule,
  );
  const [threshold, setThreshold] = useState(MOCK_PAYOUT_SETTINGS.minThreshold);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <span className={styles.formLabel}>Bank account</span>
        <div className={styles.bankCard}>
          <div className={styles.bankInfo}>
            <span className={styles.bankNumber}>
              •••• {MOCK_PAYOUT_SETTINGS.bankLast4}
            </span>
            <span className={styles.bankInstitution}>
              {MOCK_PAYOUT_SETTINGS.institution}
            </span>
          </div>
          <button type="button" className={styles.bankBtn}>
            Update bank info
          </button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <span className={styles.formLabel}>Payout schedule</span>
        <div className={styles.segControl}>
          {SCHEDULES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.segBtn} ${schedule === s.id ? styles.segBtnActive : ""}`}
              onClick={() => setSchedule(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="f-threshold" className={styles.formLabel}>
          Minimum payout threshold
        </label>
        <div className={styles.priceWrap}>
          <span className={styles.pricePre}>$</span>
          <input
            id="f-threshold"
            type="text"
            inputMode="decimal"
            className={`${styles.formInput} ${styles.priceInput}`}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.saveBtn} onClick={handleSave}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "payout", label: "Payout" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className={styles.page}>
      <Link href="/business/dashboard" className={styles.back}>
        <ArrowLeft size={16} />
        Dashboard
      </Link>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content} key={tab}>
        {tab === "profile" && <ProfileTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "payout" && <PayoutTab />}
      </div>
    </div>
  );
}
