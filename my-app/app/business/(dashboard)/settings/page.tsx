"use client";

import { ArrowLeft, ExternalLink, Eye, EyeOff, ImagePlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import styles from "./page.module.css";

type SectionId = "kitchen" | "account" | "billing" | "notifications" | "danger";

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

type KitchenForm = {
  displayName: string;
  bio: string;
  pickupStreet: string;
  pickupUnit: string;
  pickupCity: string;
  pickupProvince: string;
  pickupPostal: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupPlaceId: string | null;
  socialLink: string;
  delivery: "none" | "self";
  maxDeliveryKm: number | null;
  deliveryRatePerKm: number | null;
  deliveryFlatFee: number | null;
  freeDeliveryAbove: number | null;
};

function KitchenSection() {
  const [form, setForm] = useState<KitchenForm>({
    displayName: "",
    bio: "",
    pickupStreet: "",
    pickupUnit: "",
    pickupCity: "",
    pickupProvince: "",
    pickupPostal: "",
    pickupLat: null,
    pickupLng: null,
    pickupPlaceId: null,
    socialLink: "",
    delivery: "none",
    maxDeliveryKm: null,
    deliveryRatePerKm: null,
    deliveryFlatFee: null,
    freeDeliveryAbove: null,
  });
  const [loading, setLoading] = useState(true);
  const { saved, triggerSaved } = useSaved();

  useEffect(() => {
    fetch("/api/business/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setForm({
            displayName: json.data.displayName ?? "",
            bio: json.data.bio ?? "",
            pickupStreet: json.data.pickupStreet ?? "",
            pickupUnit: json.data.pickupUnit ?? "",
            pickupCity: json.data.pickupCity ?? "",
            pickupProvince: json.data.pickupProvince ?? "",
            pickupPostal: json.data.pickupPostal ?? "",
            pickupLat: json.data.pickupLat ?? null,
            pickupLng: json.data.pickupLng ?? null,
            pickupPlaceId: json.data.pickupPlaceId ?? null,
            socialLink: json.data.socialLink ?? "",
            delivery: json.data.delivery ?? "none",
            maxDeliveryKm:
              json.data.maxDeliveryKm != null
                ? Number(json.data.maxDeliveryKm)
                : null,
            deliveryRatePerKm:
              json.data.deliveryRatePerKm != null
                ? Number(json.data.deliveryRatePerKm)
                : null,
            deliveryFlatFee:
              json.data.deliveryFlatFee != null
                ? Number(json.data.deliveryFlatFee)
                : null,
            freeDeliveryAbove:
              json.data.freeDeliveryAbove != null
                ? Number(json.data.freeDeliveryAbove)
                : null,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    await fetch("/api/business/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName || undefined,
        bio: form.bio || undefined,
        pickupStreet: form.pickupStreet || undefined,
        pickupUnit: form.pickupUnit || null,
        pickupCity: form.pickupCity || undefined,
        pickupProvince: form.pickupProvince || undefined,
        pickupPostal: form.pickupPostal || undefined,
        pickupLat: form.pickupLat ?? undefined,
        pickupLng: form.pickupLng ?? undefined,
        pickupPlaceId: form.pickupPlaceId ?? undefined,
        socialLink: form.socialLink || undefined,
        delivery: form.delivery,
        maxDeliveryKm: form.maxDeliveryKm,
        deliveryRatePerKm: form.deliveryRatePerKm,
        deliveryFlatFee: form.deliveryFlatFee,
        freeDeliveryAbove: form.freeDeliveryAbove,
      }),
    });
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
          <span className={styles.formLabel}>Pickup address</span>
          <AddressAutocomplete
            value={{
              street: form.pickupStreet,
              unit: form.pickupUnit || undefined,
              city: form.pickupCity,
              province: form.pickupProvince,
              postal: form.pickupPostal,
              lat: form.pickupLat ?? undefined,
              lng: form.pickupLng ?? undefined,
              placeId: form.pickupPlaceId ?? undefined,
            }}
            onChange={(addr) =>
              setForm((f) => ({
                ...f,
                pickupStreet: addr.street ?? "",
                pickupUnit: addr.unit ?? "",
                pickupCity: addr.city ?? "",
                pickupProvince: addr.province ?? "",
                pickupPostal: addr.postal ?? "",
                pickupLat: addr.lat ?? null,
                pickupLng: addr.lng ?? null,
                pickupPlaceId: addr.placeId ?? null,
              }))
            }
            idPrefix="settings-pickup"
            inputClassName={styles.formInput}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="deliveryMode" className={styles.formLabel}>
            Delivery
          </label>
          <select
            id="deliveryMode"
            className={styles.formInput}
            value={form.delivery}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                delivery: e.target.value as "none" | "self",
              }))
            }
          >
            <option value="none">Pickup only</option>
            <option value="self">I deliver myself</option>
          </select>
        </div>

        {form.delivery === "self" && (
          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Delivery zone</span>
            <div className={styles.formGroup}>
              <label htmlFor="maxDeliveryKm" className={styles.formLabel}>
                Max delivery distance (km)
              </label>
              <input
                id="maxDeliveryKm"
                type="number"
                min={1}
                max={200}
                className={styles.formInput}
                value={form.maxDeliveryKm ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxDeliveryKm: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                placeholder="e.g. 10"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="deliveryFlatFee" className={styles.formLabel}>
                Flat delivery fee ($)
              </label>
              <input
                id="deliveryFlatFee"
                type="number"
                min={0}
                step={0.01}
                className={styles.formInput}
                value={form.deliveryFlatFee ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deliveryFlatFee: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                placeholder="e.g. 3.00"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="deliveryRatePerKm" className={styles.formLabel}>
                Rate per km ($)
              </label>
              <input
                id="deliveryRatePerKm"
                type="number"
                min={0}
                step={0.01}
                className={styles.formInput}
                value={form.deliveryRatePerKm ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deliveryRatePerKm: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                placeholder="e.g. 1.50"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="freeDeliveryAbove" className={styles.formLabel}>
                Free delivery above subtotal ($){" "}
                <span className={styles.formLabelOptional}>(optional)</span>
              </label>
              <input
                id="freeDeliveryAbove"
                type="number"
                min={0}
                step={0.01}
                className={styles.formInput}
                value={form.freeDeliveryAbove ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    freeDeliveryAbove: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                placeholder="e.g. 50.00 (leave blank to always charge)"
              />
            </div>
          </div>
        )}

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

      <div className={styles.cardFooter}>
        <button type="button" className={styles.saveBtn} onClick={handleSave}>
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
  phone: string;
  loginEmail: string;
};

function AccountSection() {
  const [form, setForm] = useState<AccountForm>({
    firstName: "",
    lastName: "",
    phone: "",
    loginEmail: "",
  });
  const [loading, setLoading] = useState(true);
  const [showPwForm, setShowPwForm] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const { saved, triggerSaved } = useSaved();

  useEffect(() => {
    fetch("/api/business/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setForm({
            firstName: json.data.firstName ?? "",
            lastName: json.data.lastName ?? "",
            phone: json.data.phone ?? "",
            loginEmail: json.data.email ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    await fetch("/api/business/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || null,
      }),
    });
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
            <label htmlFor="s-personal-phone" className={styles.formLabel}>
              Phone
            </label>
            <input
              id="s-personal-phone"
              type="tel"
              className={styles.formInput}
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
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
              readOnly
              style={{ opacity: 0.7 }}
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
                <div className={styles.pwInputWrap}>
                  <input
                    id="s-pw-new"
                    type={showPwNew ? "text" : "password"}
                    className={styles.formInput}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    className={styles.pwEyeBtn}
                    onClick={() => setShowPwNew((s) => !s)}
                    aria-label={showPwNew ? "Hide password" : "Show password"}
                  >
                    {showPwNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="s-pw-confirm" className={styles.formLabel}>
                  Confirm password
                </label>
                <div className={styles.pwInputWrap}>
                  <input
                    id="s-pw-confirm"
                    type={showPwConfirm ? "text" : "password"}
                    className={styles.formInput}
                  />
                  <button
                    type="button"
                    className={styles.pwEyeBtn}
                    onClick={() => setShowPwConfirm((s) => !s)}
                    aria-label={
                      showPwConfirm ? "Hide password" : "Show password"
                    }
                  >
                    {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
        <button type="button" className={styles.saveBtn} onClick={handleSave}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Billing ───────────────────────────────────────────────────────────────────

type StripeStatusData = {
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCount: number;
};

function BillingSection() {
  const [stripeStatus, setStripeStatus] = useState<StripeStatusData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);

  useEffect(() => {
    fetch("/api/business/dashboard/stripe/status")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStripeStatus(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleStripeAction() {
    setLinkLoading(true);
    try {
      const endpoint =
        stripeStatus?.hasAccount && stripeStatus?.chargesEnabled
          ? "/api/business/dashboard/stripe/dashboard-link"
          : "/api/business/dashboard/stripe/onboarding-link";
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();
      if (json.success && json.data?.url) {
        window.open(json.data.url, "_blank");
      }
    } finally {
      setLinkLoading(false);
    }
  }

  const isConnected =
    stripeStatus?.hasAccount &&
    stripeStatus?.chargesEnabled &&
    stripeStatus?.payoutsEnabled;

  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        <div className={styles.stripeStatus}>
          <div className={styles.stripeInfo}>
            {loading ? (
              <span style={{ color: "var(--muted)" }}>Loading…</span>
            ) : (
              <>
                <span
                  className={`${styles.stripeBadge} ${isConnected ? styles.stripeBadgeConnected : styles.stripeBadgePending}`}
                >
                  {isConnected ? "Connected" : "Not connected"}
                </span>
                {stripeStatus?.requirementsCount != null &&
                  stripeStatus.requirementsCount > 0 && (
                    <span className={styles.stripeDetails}>
                      <span className={styles.stripeBank}>
                        {stripeStatus.requirementsCount} requirement
                        {stripeStatus.requirementsCount !== 1 ? "s" : ""}{" "}
                        pending
                      </span>
                    </span>
                  )}
              </>
            )}
          </div>
          <button
            type="button"
            className={styles.stripeBtn}
            onClick={handleStripeAction}
            disabled={loading || linkLoading}
          >
            {linkLoading
              ? "Opening…"
              : isConnected
                ? "Manage in Stripe"
                : "Connect with Stripe"}
            <ExternalLink size={13} />
          </button>
        </div>
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

function NotificationsSection() {
  const [settings, setSettings] = useState<NotifSettings>({
    emailNotificationsNewOrder: true,
    emailNotificationsNewReview: true,
    smsNotificationsNewOrder: false,
  });
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
    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
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
      {loading ? (
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
