"use client";

import { Edit3 } from "lucide-react";
import { useState } from "react";
import { PREFERENCE_QUESTIONS } from "../_mock";
import styles from "./page.module.css";

type Tab = "profile" | "preferences" | "notifications";

type PrefAnswers = Record<string, string[]>;

const DEFAULT_PREFS: PrefAnswers = {
  diet: ["Halal"],
  spice: ["Medium"],
  group: ["2 people"],
  cuisine: ["West African", "Korean", "Middle Eastern"],
  frequency: ["Weekly"],
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [prefAnswers, setPrefAnswers] = useState<PrefAnswers>(DEFAULT_PREFS);
  const [editingPref, setEditingPref] = useState<string | null>(null);
  const [notifs, setNotifs] = useState({
    new_listing: true,
    order_updates: true,
    messages: true,
    marketing: false,
  });
  const [profile, setProfile] = useState({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "",
    neighborhood: "Roncesvalles",
  });

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

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Profile header */}
        <div className={styles.profileCard}>
          <div className={styles.avatarLg}>JD</div>
          <div>
            <div className={styles.profileName}>
              {profile.firstName} {profile.lastName}
            </div>
            <div className={styles.profileEmail}>{profile.email}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(["profile", "preferences", "notifications"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === "profile" && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Personal info</div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="settingsFirstName">
                    First name
                  </label>
                  <input
                    id="settingsFirstName"
                    className={styles.input}
                    value={profile.firstName}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, firstName: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="settingsLastName">
                    Last name
                  </label>
                  <input
                    id="settingsLastName"
                    className={styles.input}
                    value={profile.lastName}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, lastName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="settingsEmail">
                  Email
                </label>
                <input
                  id="settingsEmail"
                  className={styles.input}
                  type="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="settingsPhone">
                  Phone
                </label>
                <input
                  id="settingsPhone"
                  className={styles.input}
                  type="tel"
                  placeholder="+1 (416) 555-0000"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="settingsNeighborhood">
                  Neighbourhood
                </label>
                <input
                  id="settingsNeighborhood"
                  className={styles.input}
                  value={profile.neighborhood}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      neighborhood: e.target.value,
                    }))
                  }
                />
              </div>
              <div className={styles.cardFooter}>
                <button type="button" className={styles.saveBtn}>
                  Save changes
                </button>
              </div>
            </div>

            {/* Password */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Password</div>
              <div className={styles.formGroup}>
                <label
                  className={styles.label}
                  htmlFor="settingsCurrentPassword"
                >
                  Current password
                </label>
                <input
                  id="settingsCurrentPassword"
                  className={styles.input}
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="settingsNewPassword">
                  New password
                </label>
                <input
                  id="settingsNewPassword"
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

            {/* Danger */}
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

        {/* Preferences tab */}
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
                        const selected = answers.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`${styles.optionChip} ${selected ? styles.optionChipSelected : ""}`}
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
          </div>
        )}

        {/* Notifications tab */}
        {tab === "notifications" && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Notifications</div>
              {[
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
                const k = key as keyof typeof notifs;
                return (
                  <div key={key} className={styles.notifRow}>
                    <div className={styles.notifInfo}>
                      <span className={styles.notifLabel}>{label}</span>
                      <span className={styles.notifDesc}>{desc}</span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggle} ${notifs[k] ? styles.toggleOn : ""}`}
                      onClick={() =>
                        setNotifs((prev) => ({ ...prev, [k]: !prev[k] }))
                      }
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
