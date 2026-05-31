"use client";

import { ArrowLeft, ExternalLink, ImagePlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  MOCK_ACCOUNT,
  MOCK_CHANNELS,
  MOCK_KITCHEN,
  MOCK_NOTIFICATIONS,
  MOCK_STRIPE_ACCOUNT,
  type MockChannels,
  type MockNotification,
} from "./_mock";
import styles from "./page.module.css";

type SectionId = "kitchen" | "account" | "billing" | "notifications" | "danger";

const KITCHEN_TYPES = [
  { value: "licensed_home", label: "Licensed home kitchen" },
  { value: "commercial_rented", label: "Commercial kitchen (rented)" },
  { value: "ghost_kitchen", label: "Ghost kitchen" },
  { value: "restaurant_cafe", label: "Restaurant / café" },
  { value: "community_kitchen", label: "Community kitchen" },
  { value: "other", label: "Other" },
];

const YEARS_OPERATING = [
  "Less than 1 year",
  "1-2 years",
  "3-5 years",
  "6-10 years",
  "10+ years",
];

const ROLES = [
  "Owner",
  "Co-owner",
  "Head Chef / Cook",
  "Manager",
  "Operations Lead",
  "Other",
];

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "kitchen", label: "Kitchen" },
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

function KitchenSection() {
  const [form, setForm] = useState(MOCK_KITCHEN);
  const { saved, triggerSaved } = useSaved();

  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Profile photo</span>
          <div className={styles.dropzone}>
            <ImagePlus size={20} className={styles.dropzoneIcon} />
            <span className={styles.dropzoneText}>
              Drop a photo here or{" "}
              <span className={styles.dropzoneBrowse}>browse</span>
            </span>
            <span className={styles.dropzoneSub}>JPG or PNG, max 4 MB</span>
          </div>
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

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="s-kitchen-name" className={styles.formLabel}>
              Kitchen name
            </label>
            <input
              id="s-kitchen-name"
              type="text"
              className={styles.formInput}
              value={form.kitchenName}
              onChange={(e) =>
                setForm((f) => ({ ...f, kitchenName: e.target.value }))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="s-kitchen-type" className={styles.formLabel}>
              Kitchen type
            </label>
            <select
              id="s-kitchen-type"
              className={styles.formSelect}
              value={form.kitchenType}
              onChange={(e) =>
                setForm((f) => ({ ...f, kitchenType: e.target.value }))
              }
            >
              {KITCHEN_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formGroupNarrow}>
          <label htmlFor="s-years" className={styles.formLabel}>
            Years operating
          </label>
          <select
            id="s-years"
            className={styles.formSelect}
            value={form.yearsOperating}
            onChange={(e) =>
              setForm((f) => ({ ...f, yearsOperating: e.target.value }))
            }
          >
            {YEARS_OPERATING.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="s-street" className={styles.formLabel}>
            Street address
          </label>
          <input
            id="s-street"
            type="text"
            className={styles.formInput}
            value={form.street}
            onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
          />
        </div>

        <div className={styles.formRow3}>
          <div className={styles.formGroup}>
            <label htmlFor="s-city" className={styles.formLabel}>
              City
            </label>
            <input
              id="s-city"
              type="text"
              className={styles.formInput}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="s-province" className={styles.formLabel}>
              Province
            </label>
            <input
              id="s-province"
              type="text"
              className={styles.formInput}
              value={form.province}
              onChange={(e) =>
                setForm((f) => ({ ...f, province: e.target.value }))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="s-postal" className={styles.formLabel}>
              Postal code
            </label>
            <input
              id="s-postal"
              type="text"
              className={styles.formInput}
              value={form.postalCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, postalCode: e.target.value }))
              }
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="s-biz-phone" className={styles.formLabel}>
              Business phone
            </label>
            <input
              id="s-biz-phone"
              type="tel"
              className={styles.formInput}
              value={form.businessPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, businessPhone: e.target.value }))
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="s-biz-email" className={styles.formLabel}>
              Business email
            </label>
            <input
              id="s-biz-email"
              type="email"
              className={styles.formInput}
              value={form.businessEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, businessEmail: e.target.value }))
              }
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="s-website" className={styles.formLabel}>
            Website <span className={styles.formLabelOptional}>(optional)</span>
          </label>
          <input
            id="s-website"
            type="url"
            className={styles.formInput}
            value={form.website}
            onChange={(e) =>
              setForm((f) => ({ ...f, website: e.target.value }))
            }
          />
        </div>
      </div>

      <div className={styles.cardFooter}>
        <button type="button" className={styles.saveBtn} onClick={triggerSaved}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Account ───────────────────────────────────────────────────────────────────

function AccountSection() {
  const [form, setForm] = useState(MOCK_ACCOUNT);
  const [showPwForm, setShowPwForm] = useState(false);
  const { saved, triggerSaved } = useSaved();

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

        <div className={styles.formGroup}>
          <label htmlFor="s-role" className={styles.formLabel}>
            Role
          </label>
          <select
            id="s-role"
            className={styles.formSelect}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="s-personal-phone" className={styles.formLabel}>
              Personal phone
            </label>
            <input
              id="s-personal-phone"
              type="tel"
              className={styles.formInput}
              value={form.personalPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, personalPhone: e.target.value }))
              }
            />
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
              onChange={(e) =>
                setForm((f) => ({ ...f, loginEmail: e.target.value }))
              }
            />
          </div>
        </div>

        <div className={styles.formDivider} />

        {!showPwForm ? (
          <button
            type="button"
            className={styles.outlineBtn}
            onClick={() => setShowPwForm(true)}
          >
            Change password
          </button>
        ) : (
          <div className={styles.pwForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="s-pw-new" className={styles.formLabel}>
                  New password
                </label>
                <input
                  id="s-pw-new"
                  type="password"
                  className={styles.formInput}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="s-pw-confirm" className={styles.formLabel}>
                  Confirm password
                </label>
                <input
                  id="s-pw-confirm"
                  type="password"
                  className={styles.formInput}
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setShowPwForm(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        <button type="button" className={styles.saveBtn} onClick={triggerSaved}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Billing ───────────────────────────────────────────────────────────────────

const SCHEDULE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

function BillingSection() {
  const stripe = MOCK_STRIPE_ACCOUNT;
  const isConnected = stripe.status === "connected";

  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        <div className={styles.stripeStatus}>
          <div className={styles.stripeInfo}>
            <span
              className={`${styles.stripeBadge} ${isConnected ? styles.stripeBadgeConnected : styles.stripeBadgePending}`}
            >
              {isConnected ? "Connected" : "Not connected"}
            </span>
            {isConnected && (
              <div className={styles.stripeDetails}>
                <span className={styles.stripeBank}>{stripe.institution}</span>
                <span className={styles.stripeAccount}>
                  •••• {stripe.last4}
                </span>
              </div>
            )}
          </div>
          <button type="button" className={styles.stripeBtn}>
            {isConnected ? "Manage in Stripe" : "Connect with Stripe"}
            <ExternalLink size={13} />
          </button>
        </div>

        <div className={styles.formDivider} />

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Payout schedule</span>
          <span className={styles.readonlyVal}>
            {SCHEDULE_LABELS[stripe.schedule]}
            <span className={styles.readonlyNote}>— managed by Stripe</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications ─────────────────────────────────────────────────────────────

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

function NotificationsSection() {
  const [channels, setChannels] = useState<MockChannels>(MOCK_CHANNELS);
  const [items, setItems] = useState<MockNotification[]>(MOCK_NOTIFICATIONS);

  function toggleChannel(key: keyof MockChannels) {
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n)),
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.notifGroupHeader}>Channels</div>

      <div className={styles.notifRowBorder}>
        <div className={styles.notifRow}>
          <div className={styles.notifInfo}>
            <span className={styles.notifLabel}>Email</span>
            <span className={styles.notifDesc}>
              Receive all alerts by email.
            </span>
          </div>
          <Toggle
            on={channels.email}
            onToggle={() => toggleChannel("email")}
            label="Email"
          />
        </div>
      </div>

      <div className={styles.notifRow}>
        <div className={styles.notifInfo}>
          <span className={styles.notifLabel}>SMS</span>
          <span className={styles.notifDesc}>
            Receive urgent alerts by text message.
          </span>
        </div>
        <Toggle
          on={channels.sms}
          onToggle={() => toggleChannel("sms")}
          label="SMS"
        />
      </div>

      <div className={styles.notifGroupDivider} />
      <div className={styles.notifGroupHeader}>Alerts</div>

      {items.map((n, i) => (
        <div
          key={n.id}
          className={i < items.length - 1 ? styles.notifRowBorder : ""}
        >
          <div className={styles.notifRow}>
            <div className={styles.notifInfo}>
              <span className={styles.notifLabel}>{n.label}</span>
              <span className={styles.notifDesc}>{n.description}</span>
            </div>
            <Toggle
              on={n.enabled}
              onToggle={() => toggleItem(n.id)}
              label={n.label}
            />
          </div>
        </div>
      ))}
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
            Permanently remove your kitchen, listings, and all associated data.
            This cannot be undone.
          </div>
        </div>
        <button type="button" className={styles.deleteBtn}>
          Delete account
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("kitchen");

  const kitchenRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const billingRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const dangerRef = useRef<HTMLDivElement>(null);
  const visibleIds = useRef(new Set<SectionId>());

  useEffect(() => {
    const ORDER: SectionId[] = [
      "kitchen",
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
    const refs = [kitchenRef, accountRef, billingRef, notifRef, dangerRef];
    for (const ref of refs) {
      if (ref.current) observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: SectionId) {
    const refMap: Record<SectionId, React.RefObject<HTMLDivElement | null>> = {
      kitchen: kitchenRef,
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

          <div id="account" ref={accountRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Account</h2>
            <AccountSection />
          </div>

          <div id="billing" ref={billingRef} className={styles.section}>
            <h2 className={styles.sectionTitle}>Billing</h2>
            <BillingSection />
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
