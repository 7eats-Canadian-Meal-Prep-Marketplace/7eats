"use client";

import { CreditCard, Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

type PreferenceQuestion = {
  id: string;
  question: string;
  options: string[];
  multiSelect: boolean;
};

const PREFERENCE_QUESTIONS: PreferenceQuestion[] = [
  {
    id: "dietary",
    question: "Dietary needs",
    options: [
      "Halal",
      "Vegan",
      "Vegetarian",
      "Gluten-free",
      "Dairy-free",
      "Nut-free",
      "Kosher",
    ],
    multiSelect: true,
  },
  {
    id: "allergies",
    question: "Allergies",
    options: [
      "Tree nuts",
      "Peanuts",
      "Dairy",
      "Gluten",
      "Shellfish",
      "Eggs",
      "Soy",
      "None",
    ],
    multiSelect: true,
  },
  {
    id: "goals",
    question: "Goals & preferences",
    options: [
      "High protein",
      "Weight loss",
      "Low carb",
      "Muscle gain",
      "Heart health",
      "Comfort food",
      "Family-friendly",
      "Balanced",
    ],
    multiSelect: true,
  },
  {
    id: "whyMealPrep",
    question: "Why do you order meal prep?",
    options: [
      "Save time cooking",
      "Eat healthier",
      "Budget-friendly eating",
      "Discover new cuisines",
      "Support local home cooks",
      "Convenient for my schedule",
    ],
    multiSelect: false,
  },
];

type Tab =
  | "profile"
  | "preferences"
  | "payment"
  | "subscriptions"
  | "notifications";

const TAB_LABELS: Record<Tab, string> = {
  profile: "Profile",
  preferences: "Preferences",
  payment: "Payment",
  subscriptions: "Subscriptions",
  notifications: "Notifications",
};

type PrefAnswers = Record<string, string[]>;
const DEFAULT_PREFS: PrefAnswers = {
  dietary: ["Halal"],
  allergies: [],
  goals: ["High protein", "Comfort food"],
  whyMealPrep: ["Save time cooking"],
};

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | undefined;
  expYear: number | undefined;
};
type ActiveSub = {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  listing: { id: string; title: string };
  tier: { id: string; interval: string; price: string };
  cookDisplayName: string;
};

// ─── API types ────────────────────────────────────────────────────────────────

type ProfileData = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  neighborhood: string | null;
  dateOfBirth: string | null;
  email: string;
};

type NotifPrefs = {
  notifs: {
    new_listing: boolean;
    order_updates: boolean;
    messages: boolean;
    marketing: boolean;
  };
  channels: {
    sms: boolean;
    email: boolean;
  };
};

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  notifs: {
    new_listing: true,
    order_updates: true,
    messages: true,
    marketing: false,
  },
  channels: { sms: true, email: true },
};

// ─── Card helpers ─────────────────────────────────────────────────────────────

function detectBrand(num: string): string {
  const d = num.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^6/.test(d)) return "Discover";
  return "Card";
}

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let even = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (even) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    even = !even;
  }
  return sum % 10 === 0;
}

function validateExpiry(val: string): string | null {
  if (!/^\d{2}\/\d{2}$/.test(val)) return "Enter expiry as MM/YY";
  const [mm, yy] = val.split("/").map(Number);
  if (mm < 1 || mm > 12) return "Invalid month";
  if (
    new Date(2000 + yy, mm - 1) <
    new Date(new Date().getFullYear(), new Date().getMonth())
  )
    return "Card has expired";
  return null;
}

function formatCardNumber(raw: string): string {
  return raw
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

// ─── Add card modal ───────────────────────────────────────────────────────────

function AddCardModal({
  onSave,
  onClose,
}: {
  onSave: (card: Omit<SavedCard, "id">) => void;
  onClose: () => void;
}) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleExpiry = (val: string) => {
    let v = val.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    setExpiry(v);
  };

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    const digits = number.replace(/\D/g, "");
    if (!digits) e.number = "Card number is required";
    else if (!luhnCheck(digits)) e.number = "Invalid card number";
    const expErr = validateExpiry(expiry);
    if (expErr) e.expiry = expErr;
    if (!cvv.trim()) e.cvv = "CVV is required";
    else if (cvv.length < 3) e.cvv = "CVV must be 3–4 digits";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const [mm, yy] = expiry.split("/").map(Number);
    onSave({
      brand: detectBrand(digits),
      last4: digits.slice(-4),
      expMonth: mm,
      expYear: 2000 + yy,
    });
    onClose();
  };

  const brand = detectBrand(number.replace(/\D/g, ""));

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop dismiss
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Add a new card</h2>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalForm}>
          <div className={styles.modalField}>
            <label className={styles.modalLabel} htmlFor="cc-number">
              Card number
            </label>
            <input
              id="cc-number"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              className={`${styles.modalInput} ${errors.number ? styles.modalInputError : ""}`}
              placeholder="1234 5678 9012 3456"
              value={number}
              onChange={(e) => {
                setNumber(formatCardNumber(e.target.value));
                setErrors((p) => ({ ...p, number: "" }));
              }}
              maxLength={19}
            />
            {errors.number && (
              <p className={styles.modalError}>{errors.number}</p>
            )}
          </div>

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel} htmlFor="cc-exp">
                Expiry
              </label>
              <input
                id="cc-exp"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                className={`${styles.modalInput} ${errors.expiry ? styles.modalInputError : ""}`}
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => {
                  handleExpiry(e.target.value);
                  setErrors((p) => ({ ...p, expiry: "" }));
                }}
                maxLength={5}
              />
              {errors.expiry && (
                <p className={styles.modalError}>{errors.expiry}</p>
              )}
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel} htmlFor="cc-csc">
                CVV
              </label>
              <input
                id="cc-csc"
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                className={`${styles.modalInput} ${errors.cvv ? styles.modalInputError : ""}`}
                placeholder="•••"
                value={cvv}
                onChange={(e) => {
                  setCvv(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setErrors((p) => ({ ...p, cvv: "" }));
                }}
                maxLength={4}
              />
              {errors.cvv && <p className={styles.modalError}>{errors.cvv}</p>}
            </div>
          </div>

          {number.replace(/\D/g, "").length >= 4 && (
            <p className={styles.cardDetected}>{brand} detected</p>
          )}
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCancel}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalSubmit}
            onClick={handleSubmit}
          >
            Add card
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [prefAnswers, setPrefAnswers] = useState<PrefAnswers>(DEFAULT_PREFS);
  const [editingPref, setEditingPref] = useState<string | null>(null);

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileData | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // ── Notification state ─────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaveError, setNotifSaveError] = useState<string | null>(null);
  const [notifSaveSuccess, setNotifSaveSuccess] = useState(false);

  // ── Card / sub state ───────────────────────────────────────────────────────
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [subs, setSubs] = useState<ActiveSub[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelSubId, setConfirmCancelSubId] = useState<string | null>(
    null,
  );
  const [subCancelError, setSubCancelError] = useState<string | null>(null);

  // ── Fetch profile on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setProfileLoading(true);
    fetch("/api/user/profile")
      .then((r) => {
        if (r.status === 401) throw new Error("Not authenticated.");
        return r.json();
      })
      .then(
        (json: { success: boolean; data?: ProfileData; error?: string }) => {
          if (json.success && json.data) {
            setProfile(json.data);
          } else {
            setProfileError(json.error ?? "Failed to load profile.");
          }
        },
      )
      .catch((err: unknown) => {
        setProfileError(
          err instanceof Error ? err.message : "Failed to load profile.",
        );
      })
      .finally(() => setProfileLoading(false));
  }, []);

  // ── Fetch notifications on mount ───────────────────────────────────────────
  useEffect(() => {
    setNotifLoading(true);
    fetch("/api/user/notifications")
      .then((r) => {
        if (r.status === 401) throw new Error("Not authenticated.");
        return r.json();
      })
      .then((json: { success: boolean; data?: NotifPrefs; error?: string }) => {
        if (json.success && json.data) {
          setNotifPrefs(json.data);
        }
        // If fetch fails silently, keep DEFAULT_NOTIF_PREFS
      })
      .catch(() => {
        // Keep defaults on error — non-critical
      })
      .finally(() => setNotifLoading(false));
  }, []);

  // ── Fetch cards on mount ───────────────────────────────────────────────────
  useEffect(() => {
    setCardsLoading(true);
    fetch("/api/checkout/payment-methods")
      .then((r) => r.json())
      .then((json: { data?: SavedCard[] }) => {
        if (json.data) setCards(json.data);
      })
      .catch(() => {})
      .finally(() => setCardsLoading(false));
  }, []);

  // ── Fetch subscriptions on mount ───────────────────────────────────────────
  useEffect(() => {
    setSubsLoading(true);
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((json: { success?: boolean; data?: ActiveSub[] }) => {
        if (json.data) setSubs(json.data);
      })
      .catch(() => {})
      .finally(() => setSubsLoading(false));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const atLeastOneChannel =
    notifPrefs.channels.sms || notifPrefs.channels.email;

  const toggleAnswer = (qid: string, option: string, multi: boolean) => {
    setPrefAnswers((prev) => {
      const current = prev[qid] ?? [];
      if (multi) {
        if (current.includes(option))
          return { ...prev, [qid]: current.filter((o) => o !== option) };
        return { ...prev, [qid]: [...current, option] };
      }
      return { ...prev, [qid]: [option] };
    });
  };

  const addCard = (card: Omit<SavedCard, "id">) => {
    setCards((prev) => [...prev, { ...card, id: `pm_${Date.now()}` }]);
  };

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setConfirmDeleteId(null);
  };

  const confirmCancelSub = async (id: string) => {
    setSubCancelError(null);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setSubCancelError(json.error ?? "Failed to cancel subscription.");
        return;
      }
      setSubs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, cancelAtPeriodEnd: true } : s)),
      );
      setConfirmCancelSubId(null);
    } catch {
      setSubCancelError("Network error. Please try again.");
    }
  };

  // ── Profile save ───────────────────────────────────────────────────────────

  const handleProfileSave = async () => {
    if (!profileDraft) return;
    setProfileSaving(true);
    setProfileSaveError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileDraft.firstName,
          lastName: profileDraft.lastName,
          phone: profileDraft.phone,
          neighborhood: profileDraft.neighborhood,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: ProfileData;
        error?: string;
      };
      if (json.success && json.data) {
        setProfile(json.data);
        setEditingProfile(false);
      } else {
        setProfileSaveError(json.error ?? "Failed to save profile.");
      }
    } catch {
      setProfileSaveError("Network error. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Notifications save ─────────────────────────────────────────────────────

  const handleNotifSave = async (prefs: NotifPrefs) => {
    setNotifSaving(true);
    setNotifSaveError(null);
    setNotifSaveSuccess(false);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: NotifPrefs;
        error?: string;
      };
      if (res.status === 400) {
        setNotifSaveError(
          json.error ?? "At least one channel must be enabled.",
        );
        return;
      }
      if (json.success && json.data) {
        setNotifPrefs(json.data);
        setNotifSaveSuccess(true);
        setTimeout(() => setNotifSaveSuccess(false), 2500);
      } else {
        setNotifSaveError(
          json.error ?? "Failed to save notification settings.",
        );
      }
    } catch {
      setNotifSaveError("Network error. Please try again.");
    } finally {
      setNotifSaving(false);
    }
  };

  // ── Avatar initials ────────────────────────────────────────────────────────

  const avatarInitials = profile
    ? `${(profile.firstName ?? "?")[0] ?? "?"}${(profile.lastName ?? "")[0] ?? ""}`.toUpperCase()
    : "…";

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      "Your Account"
    : "Loading…";

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.profileCard}>
          <div className={styles.avatarLg}>{avatarInitials}</div>
          <div>
            <div className={styles.profileName}>{displayName}</div>
            <div className={styles.profileEmail}>{profile?.email ?? ""}</div>
          </div>
        </div>

        <div className={styles.tabs}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Profile */}
        {tab === "profile" && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>
                <span>Personal info</span>
                {!editingProfile && !profileLoading && (
                  <button
                    type="button"
                    className={styles.editProfileBtn}
                    onClick={() => {
                      setEditingProfile(true);
                      setProfileDraft(profile ? { ...profile } : null);
                      setProfileSaveError(null);
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>

              {profileLoading ? (
                <div className={styles.profileInfoList}>
                  {[
                    "First name",
                    "Last name",
                    "Phone",
                    "Neighbourhood",
                    "Date of birth",
                  ].map((label) => (
                    <div key={label} className={styles.profileInfoRow}>
                      <span className={styles.profileInfoLabel}>{label}</span>
                      <span
                        className={styles.profileInfoEmpty}
                        aria-busy="true"
                      >
                        Loading…
                      </span>
                    </div>
                  ))}
                </div>
              ) : profileError ? (
                <p className={styles.channelError}>{profileError}</p>
              ) : !editingProfile ? (
                <div className={styles.profileInfoList}>
                  <div className={styles.profileInfoRow}>
                    <span className={styles.profileInfoLabel}>First name</span>
                    <span className={styles.profileInfoVal}>
                      {profile?.firstName || (
                        <span className={styles.profileInfoEmpty}>Not set</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.profileInfoRow}>
                    <span className={styles.profileInfoLabel}>Last name</span>
                    <span className={styles.profileInfoVal}>
                      {profile?.lastName || (
                        <span className={styles.profileInfoEmpty}>Not set</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.profileInfoRow}>
                    <span className={styles.profileInfoLabel}>Phone</span>
                    <span className={styles.profileInfoVal}>
                      {profile?.phone || (
                        <span className={styles.profileInfoEmpty}>Not set</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.profileInfoRow}>
                    <span className={styles.profileInfoLabel}>
                      Neighbourhood
                    </span>
                    <span className={styles.profileInfoVal}>
                      {profile?.neighborhood || (
                        <span className={styles.profileInfoEmpty}>Not set</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.profileInfoRow}>
                    <span className={styles.profileInfoLabel}>
                      Date of birth
                    </span>
                    <span className={styles.profileInfoVal}>
                      {profile?.dateOfBirth ? (
                        new Date(profile.dateOfBirth).toLocaleDateString(
                          "en-CA",
                          { year: "numeric", month: "long", day: "numeric" },
                        )
                      ) : (
                        <span className={styles.profileInfoEmpty}>Not set</span>
                      )}
                    </span>
                  </div>
                </div>
              ) : profileDraft ? (
                <>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="fn">
                        First name
                      </label>
                      <input
                        id="fn"
                        className={styles.input}
                        value={profileDraft.firstName ?? ""}
                        onChange={(e) =>
                          setProfileDraft((p) =>
                            p ? { ...p, firstName: e.target.value } : p,
                          )
                        }
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="ln">
                        Last name
                      </label>
                      <input
                        id="ln"
                        className={styles.input}
                        value={profileDraft.lastName ?? ""}
                        onChange={(e) =>
                          setProfileDraft((p) =>
                            p ? { ...p, lastName: e.target.value } : p,
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="ph">
                      Phone
                    </label>
                    <input
                      id="ph"
                      className={styles.input}
                      type="tel"
                      placeholder="+1 (416) 555-0000"
                      value={profileDraft.phone ?? ""}
                      onChange={(e) =>
                        setProfileDraft((p) =>
                          p ? { ...p, phone: e.target.value } : p,
                        )
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="nb">
                      Neighbourhood
                    </label>
                    <input
                      id="nb"
                      className={styles.input}
                      value={profileDraft.neighborhood ?? ""}
                      onChange={(e) =>
                        setProfileDraft((p) =>
                          p ? { ...p, neighborhood: e.target.value } : p,
                        )
                      }
                    />
                  </div>
                  {profileSaveError && (
                    <p className={styles.channelError}>{profileSaveError}</p>
                  )}
                  <div className={styles.cardFooter}>
                    <div className={styles.editProfileActions}>
                      <button
                        type="button"
                        className={styles.cancelProfileBtn}
                        onClick={() => {
                          setProfileDraft(null);
                          setEditingProfile(false);
                          setProfileSaveError(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.saveBtn}
                        disabled={profileSaving}
                        onClick={handleProfileSave}
                      >
                        {profileSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Email address</div>
              <div className={styles.emailReadOnlyBlock}>
                <span className={styles.emailReadOnlyVal}>
                  {profile?.email ?? ""}
                </span>
                <span className={styles.emailReadOnlyNote}>
                  To change your email address, contact support.
                </span>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Password</div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cp">
                  Current password
                </label>
                <input
                  id="cp"
                  className={styles.input}
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="np">
                  New password
                </label>
                <input
                  id="np"
                  className={styles.input}
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <div className={styles.cardFooter}>
                <button type="button" className={styles.saveBtn}>
                  Update password
                </button>
              </div>
            </div>

            <div className={`${styles.card} ${styles.dangerCard}`}>
              <div className={styles.dangerRow}>
                <div>
                  <div className={styles.dangerTitle}>Delete account</div>
                  <div className={styles.dangerDesc}>
                    Permanently delete your account and all data. This cannot be
                    undone.
                  </div>
                </div>
                <button type="button" className={styles.deleteBtn}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preferences */}
        {tab === "preferences" && (
          <div className={styles.tabContent}>
            <p className={styles.prefIntro}>
              Your preference sheet helps cooks understand you better before you
              even message them.
            </p>
            {PREFERENCE_QUESTIONS.map((q) => {
              const answers = prefAnswers[q.id] ?? [];
              const isEditing = editingPref === q.id;
              return (
                <div key={q.id} className={styles.prefCard}>
                  <div className={styles.prefHeader}>
                    <span className={styles.prefQuestion}>{q.question}</span>
                    <button
                      type="button"
                      className={styles.editPrefBtn}
                      onClick={() => setEditingPref(isEditing ? null : q.id)}
                    >
                      {isEditing ? "Done" : <Edit3 size={14} />}
                    </button>
                  </div>
                  {isEditing ? (
                    <div className={styles.prefOptions}>
                      {q.options.map((opt) => {
                        const sel = answers.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`${styles.optionChip} ${sel ? styles.optionChipSelected : ""}`}
                            onClick={() =>
                              toggleAnswer(q.id, opt, q.multiSelect)
                            }
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.prefAnswers}>
                      {answers.length > 0 ? (
                        answers.map((a) => (
                          <span key={a} className={styles.answerTag}>
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className={styles.unanswered}>Not answered</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => {
                fetch("/api/auth/complete-onboarding", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(prefAnswers),
                }).catch(() => {});
              }}
            >
              Save preferences
            </button>
          </div>
        )}

        {/* Payment */}
        {tab === "payment" && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Saved cards</div>
              <p className={styles.cardDesc}>
                Cards on file are used for orders and weekly subscriptions.
              </p>
              <div className={styles.cardList}>
                {cardsLoading ? (
                  <p className={styles.profileInfoEmpty}>Loading…</p>
                ) : cards.length === 0 ? (
                  <p className={styles.profileInfoEmpty}>No saved cards.</p>
                ) : null}
                {!cardsLoading &&
                  cards.map((card) =>
                    confirmDeleteId === card.id ? (
                      <div key={card.id} className={styles.deleteConfirmRow}>
                        <span className={styles.deleteConfirmText}>
                          Remove {card.brand} ···· {card.last4}?
                        </span>
                        <div className={styles.deleteConfirmActions}>
                          <button
                            type="button"
                            className={styles.deleteConfirmCancel}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            className={styles.deleteConfirmRemove}
                            onClick={() => removeCard(card.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={card.id} className={styles.paymentRow}>
                        <div className={styles.paymentRowLeft}>
                          <CreditCard
                            size={18}
                            className={styles.paymentIcon}
                          />
                          <div className={styles.paymentInfo}>
                            <span className={styles.paymentBrand}>
                              {card.brand} ···· {card.last4}
                            </span>
                            <span className={styles.paymentExp}>
                              Expires{" "}
                              {card.expMonth
                                ? card.expMonth.toString().padStart(2, "0")
                                : "??"}
                              /
                              {card.expYear
                                ? card.expYear.toString().slice(-2)
                                : "??"}
                            </span>
                          </div>
                        </div>
                        <div className={styles.paymentRowActions}>
                          <button
                            type="button"
                            className={styles.removeCardBtn}
                            onClick={() => setConfirmDeleteId(card.id)}
                            aria-label="Remove card"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
              </div>
              <button
                type="button"
                className={styles.addCardBtn}
                onClick={() => setShowAddCard(true)}
              >
                <Plus size={15} />
                Add a new card
              </button>
            </div>
          </div>
        )}

        {/* Subscriptions */}
        {tab === "subscriptions" && (
          <div className={styles.tabContent}>
            {subsLoading ? (
              <p className={styles.profileInfoEmpty}>Loading…</p>
            ) : subs.length === 0 ? (
              <div className={styles.subEmpty}>
                <RefreshCw size={32} className={styles.subEmptyIcon} />
                <p className={styles.subEmptyText}>No active subscriptions.</p>
                <p className={styles.subEmptyDesc}>
                  When you subscribe to a weekly listing it will appear here.
                </p>
              </div>
            ) : (
              <>
                <p className={styles.prefIntro}>
                  Charges occur automatically each week until you cancel.
                </p>
                {subCancelError && (
                  <p className={styles.profileInfoEmpty}>{subCancelError}</p>
                )}
                {subs.map((sub) => {
                  const isActive =
                    sub.status === "active" && !sub.cancelAtPeriodEnd;
                  const isCancelling =
                    sub.status === "active" && sub.cancelAtPeriodEnd;
                  const nextDateLabel = sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString(
                        "en-CA",
                        { weekday: "short", month: "short", day: "numeric" },
                      )
                    : null;
                  return (
                    <div key={sub.id} className={styles.subCard}>
                      <div className={styles.subCardTop}>
                        <div className={styles.subCardInfo}>
                          <div className={styles.subCardTitle}>
                            {sub.listing.title}
                          </div>
                          <div className={styles.subCardCook}>
                            {sub.cookDisplayName}
                          </div>
                        </div>
                        <div className={styles.subCardRight}>
                          <span
                            className={`${styles.subStatus} ${isActive ? styles.subStatusActive : styles.subStatusCancelled}`}
                          >
                            {isActive
                              ? "Active"
                              : isCancelling
                                ? "Cancelling"
                                : "Cancelled"}
                          </span>
                          <span className={styles.subPrice}>
                            ${Number(sub.tier.price)}
                            <span className={styles.subInterval}>
                              /{sub.tier.interval}
                            </span>
                          </span>
                        </div>
                      </div>
                      {/* Cancellation guard — shown when user clicked Cancel */}
                      {confirmCancelSubId === sub.id ? (
                        <div className={styles.subCancelConfirm}>
                          <div className={styles.subCancelConfirmText}>
                            <span className={styles.subCancelConfirmTitle}>
                              Cancel this subscription?
                            </span>
                            <span className={styles.subCancelConfirmPolicy}>
                              Your subscription will remain active until{" "}
                              <strong>
                                {nextDateLabel ?? "end of period"}
                              </strong>
                              . No further charges after that.
                            </span>
                          </div>
                          <div className={styles.subCancelConfirmActions}>
                            <button
                              type="button"
                              className={styles.subCancelKeep}
                              onClick={() => setConfirmCancelSubId(null)}
                            >
                              Keep
                            </button>
                            <button
                              type="button"
                              className={styles.subCancelConfirmBtn}
                              onClick={() => confirmCancelSub(sub.id)}
                            >
                              Confirm cancellation
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.subCardFooter}>
                          {isActive && nextDateLabel ? (
                            <span className={styles.subNextDate}>
                              <RefreshCw size={11} />
                              Next charge · {nextDateLabel}
                            </span>
                          ) : isCancelling && nextDateLabel ? (
                            <span className={styles.subCancelledNote}>
                              Cancels after <strong>{nextDateLabel}</strong>
                            </span>
                          ) : (
                            <span className={styles.subCancelledNote}>
                              Cancelled
                            </span>
                          )}
                          {isActive && (
                            <button
                              type="button"
                              className={styles.cancelSubBtn}
                              onClick={() => setConfirmCancelSubId(sub.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Notifications */}
        {tab === "notifications" && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Notifications</div>
              {notifLoading ? (
                <p className={styles.profileInfoEmpty}>Loading…</p>
              ) : (
                [
                  {
                    key: "new_listing",
                    label: "New listings from saved cooks",
                    desc: "Get notified when a cook you follow posts a new listing.",
                  },
                  {
                    key: "order_updates",
                    label: "Order updates",
                    desc: "Pickup reminders and status changes for your orders.",
                  },
                  {
                    key: "messages",
                    label: "Messages",
                    desc: "Receive notifications when a cook messages you.",
                  },
                  {
                    key: "marketing",
                    label: "Tips & updates",
                    desc: "Occasional emails about new cooks and features.",
                  },
                ].map(({ key, label, desc }) => {
                  const k = key as keyof typeof notifPrefs.notifs;
                  return (
                    <div key={key} className={styles.notifRow}>
                      <div className={styles.notifInfo}>
                        <span className={styles.notifLabel}>{label}</span>
                        <span className={styles.notifDesc}>{desc}</span>
                      </div>
                      <button
                        type="button"
                        className={`${styles.toggle} ${notifPrefs.notifs[k] ? styles.toggleOn : ""}`}
                        onClick={() =>
                          setNotifPrefs((prev) => ({
                            ...prev,
                            notifs: { ...prev.notifs, [k]: !prev.notifs[k] },
                          }))
                        }
                      >
                        <span className={styles.toggleKnob} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Communication channels */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>How we reach you</div>
              <p className={styles.cardDesc}>
                You must keep at least one channel enabled to receive order
                updates.
              </p>
              {notifLoading ? (
                <p className={styles.profileInfoEmpty}>Loading…</p>
              ) : (
                [
                  {
                    key: "sms" as const,
                    label: "SMS",
                    desc: "Text messages to your verified phone number.",
                  },
                  {
                    key: "email" as const,
                    label: "Email",
                    desc: "Notifications sent to your email address.",
                  },
                ].map(({ key, label, desc }) => {
                  const isOn = notifPrefs.channels[key];
                  const wouldDisableLast = Object.values({
                    ...notifPrefs.channels,
                    [key]: !isOn,
                  }).every((v) => !v);
                  return (
                    <div key={key} className={styles.notifRow}>
                      <div className={styles.notifInfo}>
                        <span className={styles.notifLabel}>{label}</span>
                        <span className={styles.notifDesc}>{desc}</span>
                      </div>
                      <button
                        type="button"
                        className={`${styles.toggle} ${isOn ? styles.toggleOn : ""} ${wouldDisableLast ? styles.toggleDisabled : ""}`}
                        disabled={wouldDisableLast}
                        onClick={() => {
                          const next = {
                            ...notifPrefs.channels,
                            [key]: !isOn,
                          };
                          if (next.sms || next.email) {
                            setNotifPrefs((prev) => ({
                              ...prev,
                              channels: next,
                            }));
                          }
                        }}
                        aria-label={
                          isOn ? `Disable ${label}` : `Enable ${label}`
                        }
                      >
                        <span className={styles.toggleKnob} />
                      </button>
                    </div>
                  );
                })
              )}
              {!atLeastOneChannel && (
                <p className={styles.channelError}>
                  At least one channel must stay enabled.
                </p>
              )}
            </div>

            {/* Save notifications button */}
            <div className={styles.cardFooter}>
              {notifSaveError && (
                <p className={styles.channelError}>{notifSaveError}</p>
              )}
              {notifSaveSuccess && (
                <p className={styles.saveSuccessMsg}>
                  Notification preferences saved.
                </p>
              )}
              <button
                type="button"
                className={styles.saveBtn}
                disabled={notifSaving || notifLoading}
                onClick={() => handleNotifSave(notifPrefs)}
              >
                {notifSaving ? "Saving…" : "Save notifications"}
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddCard && (
        <AddCardModal onSave={addCard} onClose={() => setShowAddCard(false)} />
      )}
    </div>
  );
}
