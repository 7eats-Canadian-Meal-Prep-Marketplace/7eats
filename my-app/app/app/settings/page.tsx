"use client";

import { CreditCard, Edit3, Lock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ImageDropzone from "@/app/components/ImageDropzone";
import {
  type ClientNotificationPrefs,
  clientNotificationPrefsEqual,
  DEFAULT_CLIENT_NOTIFICATION_PREFS,
  normalizeClientNotificationPrefs,
} from "@/lib/client-notification-preferences";
import {
  CLIENT_PREFERENCE_QUESTIONS,
  type ClientPreferenceKey,
  type ClientPreferences,
  clientPreferencesEqual,
  EMPTY_CLIENT_PREFERENCES,
  normalizeClientPreferences,
  togglePreference,
} from "@/lib/client-preferences";
import {
  formatPhoneDisplay,
  isValidNorthAmericanPhone,
  phoneDigits,
} from "@/lib/phone";
import { profileDisplayName, profileInitials } from "@/lib/user-display";
import { useApp } from "../_app-context";
import { Skeleton } from "../_skeleton";
import { AddCardModal } from "./_add-card-modal";
import { DeleteAccountModal } from "./_delete-account-modal";
import styles from "./page.module.css";

type PrefAnswers = ClientPreferences;

type Tab = "profile" | "preferences" | "payment" | "notifications";

const TAB_LABELS: Record<Tab, string> = {
  profile: "Profile",
  preferences: "Preferences",
  payment: "Payment",
  notifications: "Notifications",
};

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | undefined;
  expYear: number | undefined;
};
// ─── API types ────────────────────────────────────────────────────────────────

type ProfileData = {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  dateOfBirth: string | null;
  email: string;
  image: string | null;
};

function syncProfileToShell(
  data: ProfileData,
  setters: {
    setUserImage: (url: string | null) => void;
    setUserInitials: (initials: string) => void;
    setUserName: (name: string) => void;
  },
) {
  setters.setUserImage(data.image);
  setters.setUserInitials(
    profileInitials(data.firstName, data.lastName, data.name, data.email),
  );
  setters.setUserName(
    profileDisplayName(data.firstName, data.lastName, data.name, data.email),
  );
}

type NotifPrefs = ClientNotificationPrefs;

const DEFAULT_NOTIF_PREFS = DEFAULT_CLIENT_NOTIFICATION_PREFS;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { setUserImage, setUserInitials, setUserName } = useApp();
  const [tab, setTab] = useState<Tab>("profile");
  const [prefAnswers, setPrefAnswers] = useState<PrefAnswers>(
    EMPTY_CLIENT_PREFERENCES,
  );
  const [savedPrefs, setSavedPrefs] = useState<PrefAnswers>(
    EMPTY_CLIENT_PREFERENCES,
  );
  const [prefLoading, setPrefLoading] = useState(true);
  const [prefSaving, setPrefSaving] = useState(false);
  const [editingPref, setEditingPref] = useState<ClientPreferenceKey | null>(
    null,
  );

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileData | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const photoFileRef = useRef<File | null>(null);
  const [photoPending, setPhotoPending] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoDropzoneKey, setPhotoDropzoneKey] = useState(0);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [phoneChangeOpen, setPhoneChangeOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // ── Notification state ─────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [savedNotifPrefs, setSavedNotifPrefs] =
    useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaveError, setNotifSaveError] = useState<string | null>(null);
  const [notifSaveSuccess, setNotifSaveSuccess] = useState(false);
  const [orderUpdatesOffConfirm, setOrderUpdatesOffConfirm] = useState(false);

  // ── Card / sub state ───────────────────────────────────────────────────────
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setCardsLoading(true);
    setCardsError(null);
    try {
      const res = await fetch("/api/checkout/payment-methods");
      if (res.status === 401) throw new Error("Not authenticated.");
      const json = (await res.json()) as {
        data?: SavedCard[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load saved cards.");
      }
      setCards(json.data ?? []);
    } catch (err) {
      setCards([]);
      setCardsError(
        err instanceof Error ? err.message : "Failed to load saved cards.",
      );
    } finally {
      setCardsLoading(false);
    }
  }, []);

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
            const data = {
              ...json.data,
              phoneVerified: json.data.phoneVerified ?? false,
            };
            setProfile(data);
            syncProfileToShell(data, {
              setUserImage,
              setUserInitials,
              setUserName,
            });
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
  }, [setUserImage, setUserInitials, setUserName]);

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
          const normalized = normalizeClientNotificationPrefs(json.data);
          setNotifPrefs(normalized);
          setSavedNotifPrefs(normalized);
        }
        // If fetch fails silently, keep DEFAULT_NOTIF_PREFS
      })
      .catch(() => {
        // Keep defaults on error — non-critical
      })
      .finally(() => setNotifLoading(false));
  }, []);

  // ── Fetch preferences on mount ─────────────────────────────────────────────
  useEffect(() => {
    setPrefLoading(true);
    fetch("/api/user/preferences")
      .then((r) => {
        if (r.status === 401) throw new Error("Not authenticated.");
        return r.json();
      })
      .then(
        (json: { success: boolean; data?: PrefAnswers; error?: string }) => {
          if (json.success && json.data) {
            const normalized = normalizeClientPreferences(json.data);
            setPrefAnswers(normalized);
            setSavedPrefs(normalized);
          }
        },
      )
      .catch(() => {
        toast.error("Could not load your preferences.");
      })
      .finally(() => setPrefLoading(false));
  }, []);

  // ── Fetch cards on mount ───────────────────────────────────────────────────
  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const atLeastOneChannel =
    notifPrefs.channels.sms || notifPrefs.channels.email;

  const notifsDirty = !clientNotificationPrefsEqual(
    savedNotifPrefs,
    notifPrefs,
  );

  const orderUpdatesOn = notifPrefs.notifs.order_updates;
  const smsChannelOn = notifPrefs.channels.sms;
  const emailChannelOn = notifPrefs.channels.email;
  const phoneVerified = profile?.phoneVerified ?? false;
  const phoneDisplay = profile?.phone
    ? formatPhoneDisplay(profile.phone)
    : null;

  const orderUpdatesDesc = orderUpdatesOn
    ? [emailChannelOn && "email", smsChannelOn && phoneVerified && "text"]
        .filter(Boolean)
        .join(" and ")
    : null;

  const prefsDirty = !clientPreferencesEqual(savedPrefs, prefAnswers);

  const toggleAnswer = (
    qid: ClientPreferenceKey,
    option: string,
    multi: boolean,
  ) => {
    setPrefAnswers((prev) => togglePreference(prev, qid, option, multi));
  };

  const addCard = () => {
    setShowAddCard(true);
  };

  const handleCardSaved = () => {
    toast.success("Card saved.");
    void loadCards();
  };

  const removeCard = async (id: string) => {
    if (removingCardId) return;
    setRemovingCardId(id);
    try {
      const res = await fetch(`/api/checkout/payment-methods/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Could not remove card.");
        return;
      }
      setConfirmDeleteId(null);
      await loadCards();
      toast.success("Card removed.");
    } catch {
      toast.error("Could not remove card.");
    } finally {
      setRemovingCardId(null);
    }
  };

  const handlePrefSave = async () => {
    if (!prefsDirty || prefSaving) return;
    setPrefSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefAnswers),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: PrefAnswers;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error ?? "Could not save preferences.");
        return;
      }
      const normalized = normalizeClientPreferences(json.data);
      setPrefAnswers(normalized);
      setSavedPrefs(normalized);
      setEditingPref(null);
      toast.success("Preferences saved.");
    } catch {
      toast.error("Could not save preferences.");
    } finally {
      setPrefSaving(false);
    }
  };

  // ── Profile save ───────────────────────────────────────────────────────────

  const profileNamesDirty = useMemo(() => {
    if (!profile || !profileDraft) return false;
    const draftFirst = profileDraft.firstName?.trim() ?? "";
    const draftLast = profileDraft.lastName?.trim() ?? "";
    const savedFirst = profile.firstName?.trim() ?? "";
    const savedLast = profile.lastName?.trim() ?? "";
    return draftFirst !== savedFirst || draftLast !== savedLast;
  }, [profile, profileDraft]);

  function resetPhoneChange() {
    setPhoneChangeOpen(false);
    setPendingPhone("");
    setOtpSent(false);
    setOtpCode("");
    setPhoneError(null);
  }

  const handleProfileSave = async () => {
    if (!profileDraft || !profileNamesDirty) return;

    const firstName = profileDraft.firstName?.trim() ?? "";
    const lastName = profileDraft.lastName?.trim() ?? "";
    if (!firstName || !lastName) {
      setProfileSaveError("First and last name are required.");
      return;
    }

    setProfileSaving(true);
    setProfileSaveError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: ProfileData;
        error?: string;
      };
      if (json.success && json.data) {
        setProfile(json.data);
        syncProfileToShell(json.data, {
          setUserImage,
          setUserInitials,
          setUserName,
        });
        setEditingProfile(false);
        toast.success("Profile updated.");
      } else {
        setProfileSaveError(json.error ?? "Failed to save profile.");
      }
    } catch {
      setProfileSaveError("Network error. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  async function sendPhoneCode() {
    setPhoneError(null);

    if (!isValidNorthAmericanPhone(pendingPhone)) {
      setPhoneError("Enter a valid 10-digit phone number.");
      return;
    }
    if (
      profile?.phone &&
      phoneDigits(pendingPhone) === phoneDigits(profile.phone)
    ) {
      setPhoneError("That is already your phone number.");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await fetch("/api/auth/client/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits(pendingPhone) }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
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
      const res = await fetch("/api/auth/client/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { phone?: string; phoneVerified?: boolean };
        error?: string;
      };
      if (!res.ok || !json.success) {
        setPhoneError(json.error ?? "Verification failed.");
        return;
      }
      const phone = json.data?.phone ?? phoneDigits(pendingPhone);
      setProfile((prev) =>
        prev ? { ...prev, phone, phoneVerified: true } : prev,
      );
      resetPhoneChange();
      toast.success("Phone number updated.");
    } finally {
      setPhoneLoading(false);
    }
  }

  const handlePhotoSave = async () => {
    if (!photoFileRef.current || photoSaving) return;
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      const fd = new FormData();
      fd.set("photo", photoFileRef.current);
      const res = await fetch("/api/user/profile/photo", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { image: string | null };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        setPhotoError(json.error ?? "Could not upload profile photo.");
        return;
      }
      setProfile((prev) =>
        prev ? { ...prev, image: json.data?.image ?? prev.image } : prev,
      );
      if (json.data?.image) {
        setUserImage(json.data.image);
      }
      photoFileRef.current = null;
      setPhotoPending(false);
      setPhotoDropzoneKey((k) => k + 1);
      toast.success("Profile photo updated.");
    } catch {
      setPhotoError("Could not upload profile photo.");
    } finally {
      setPhotoSaving(false);
    }
  };

  const handlePhotoRemove = async () => {
    if (!profile?.image || photoRemoving || photoSaving) return;
    setPhotoRemoving(true);
    setPhotoError(null);
    try {
      const res = await fetch("/api/user/profile/photo", { method: "DELETE" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { image: string | null };
        error?: string;
      };
      if (!res.ok || !json.success) {
        setPhotoError(json.error ?? "Could not remove profile photo.");
        return;
      }
      const next = profile ? { ...profile, image: null } : null;
      setProfile(next);
      if (next) {
        syncProfileToShell(next, {
          setUserImage,
          setUserInitials,
          setUserName,
        });
      }
      photoFileRef.current = null;
      setPhotoPending(false);
      setPhotoDropzoneKey((k) => k + 1);
      toast.success("Profile photo removed.");
    } catch {
      setPhotoError("Could not remove profile photo.");
    } finally {
      setPhotoRemoving(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!profile?.email || resetLoading) return;
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, audience: "client" }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error ?? "Could not send reset email.");
        return;
      }
      setResetSent(true);
      toast.success("Password reset link sent. Check your email.");
    } catch {
      toast.error("Could not send reset email.");
    } finally {
      setResetLoading(false);
    }
  };

  // ── Notifications save ─────────────────────────────────────────────────────

  const handleNotifSave = async (prefs: NotifPrefs) => {
    if (!prefs.channels.sms && !prefs.channels.email) {
      setNotifSaveError("At least one notification channel must be enabled.");
      return;
    }
    setNotifSaving(true);
    setNotifSaveError(null);
    setNotifSaveSuccess(false);
    setOrderUpdatesOffConfirm(false);
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
        const normalized = normalizeClientNotificationPrefs(json.data);
        setNotifPrefs(normalized);
        setSavedNotifPrefs(normalized);
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

  const requestNotifSave = () => {
    if (!notifsDirty || notifSaving || notifLoading) return;
    if (!atLeastOneChannel) {
      setNotifSaveError("At least one notification channel must be enabled.");
      return;
    }
    setNotifSaveError(null);
    if (!notifPrefs.notifs.order_updates) {
      setOrderUpdatesOffConfirm(true);
      return;
    }
    void handleNotifSave(notifPrefs);
  };

  // ── Avatar initials ────────────────────────────────────────────────────────

  const avatarInitials = profile
    ? profileInitials(
        profile.firstName,
        profile.lastName,
        profile.name,
        profile.email,
      )
    : "…";

  const displayName = profile
    ? profileDisplayName(
        profile.firstName,
        profile.lastName,
        profile.name,
        profile.email,
      )
    : "Loading…";

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.profileCard}>
          <div className={styles.avatarLg}>
            {profile?.image ? (
              // biome-ignore lint/performance/noImgElement: user avatar from CDN
              <img src={profile.image} alt="" className={styles.avatarLgImg} />
            ) : (
              avatarInitials
            )}
          </div>
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
              <div className={styles.cardTitle}>Profile photo</div>
              <div className={styles.cardBody}>
                {profileLoading ? (
                  <div aria-busy="true">
                    <Skeleton circle width={96} height={96} />
                  </div>
                ) : (
                  <>
                    <ImageDropzone
                      key={photoDropzoneKey}
                      id="client-profile-photo"
                      variant="avatar"
                      existingUrl={profile?.image ?? null}
                      alt="Your profile photo"
                      onFile={(file) => {
                        photoFileRef.current = file;
                        setPhotoPending(Boolean(file));
                        if (photoError) setPhotoError(null);
                      }}
                      note="JPG or PNG, max 4 MB"
                    />
                    {photoError && (
                      <p className={styles.channelError} role="alert">
                        {photoError}
                      </p>
                    )}
                    {photoPending ? (
                      <div className={styles.photoSaveRow}>
                        <button
                          type="button"
                          className={styles.saveBtn}
                          onClick={() => void handlePhotoSave()}
                          disabled={photoSaving || photoRemoving}
                        >
                          {photoSaving ? "Saving…" : "Save photo"}
                        </button>
                      </div>
                    ) : (
                      profile?.image && (
                        <div className={styles.photoSaveRow}>
                          <button
                            type="button"
                            className={`${styles.secondaryActionBtn} ${styles.secondaryActionBtnDanger}`}
                            onClick={() => void handlePhotoRemove()}
                            disabled={photoRemoving || photoSaving}
                          >
                            {photoRemoving ? "Removing…" : "Remove photo"}
                          </button>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </div>

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
                      resetPhoneChange();
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>

              {profileLoading ? (
                <div className={styles.profileInfoList}>
                  {["First name", "Last name", "Date of birth", "Phone"].map(
                    (label) => (
                      <div key={label} className={styles.profileInfoRow}>
                        <span className={styles.profileInfoLabel}>{label}</span>
                        <Skeleton width={120} height={14} radius={6} />
                      </div>
                    ),
                  )}
                </div>
              ) : profileError ? (
                <p className={styles.channelError}>{profileError}</p>
              ) : !editingProfile ? (
                <>
                  <div className={styles.profileInfoList}>
                    <div className={styles.profileInfoRow}>
                      <span className={styles.profileInfoLabel}>
                        First name
                      </span>
                      <span className={styles.profileInfoVal}>
                        {profile?.firstName || (
                          <span className={styles.profileInfoEmpty}>
                            Not set
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles.profileInfoRow}>
                      <span className={styles.profileInfoLabel}>Last name</span>
                      <span className={styles.profileInfoVal}>
                        {profile?.lastName || (
                          <span className={styles.profileInfoEmpty}>
                            Not set
                          </span>
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
                          <span className={styles.profileInfoEmpty}>
                            Not set
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles.profileInfoRow}>
                      <span className={styles.profileInfoLabel}>Phone</span>
                      <span className={styles.profileInfoVal}>
                        <span className={styles.phoneDisplay}>
                          {profile?.phone ? (
                            formatPhoneDisplay(profile.phone)
                          ) : (
                            <span className={styles.profileInfoEmpty}>
                              Not set
                            </span>
                          )}
                          {profile?.phone && profile.phoneVerified && (
                            <span className={styles.phoneBadge}>Verified</span>
                          )}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div
                    className={`${styles.phoneSection} ${phoneChangeOpen ? styles.phoneSectionOpen : ""}`}
                  >
                    {!phoneChangeOpen ? (
                      <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={() => {
                          setPhoneChangeOpen(true);
                          setPhoneError(null);
                          setPendingPhone("");
                        }}
                      >
                        Change phone number
                      </button>
                    ) : (
                      <div className={styles.phoneChangePanel}>
                        <div className={styles.phonePanelHead}>
                          <p className={styles.phonePanelTitle}>
                            {otpSent
                              ? "Enter verification code"
                              : "Update phone number"}
                          </p>
                          {otpSent ? (
                            <p className={styles.phonePanelDesc}>
                              We sent a 6-digit code to{" "}
                              {formatPhoneDisplay(pendingPhone)}.
                            </p>
                          ) : (
                            <p className={styles.phonePanelDesc}>
                              We&apos;ll text you a code to confirm the new
                              number.
                            </p>
                          )}
                        </div>

                        {!otpSent ? (
                          <div className={styles.phoneField}>
                            <label
                              htmlFor="client-new-phone"
                              className={styles.phoneFieldLabel}
                            >
                              Mobile number
                            </label>
                            <input
                              id="client-new-phone"
                              type="tel"
                              inputMode="numeric"
                              className={styles.phoneFieldInput}
                              value={pendingPhone}
                              onChange={(e) => {
                                setPendingPhone(
                                  formatPhoneDisplay(e.target.value),
                                );
                                setPhoneError(null);
                              }}
                              placeholder="(416) 555-0100"
                              disabled={phoneLoading}
                              autoComplete="tel"
                            />
                          </div>
                        ) : (
                          <div className={styles.phoneField}>
                            <label
                              htmlFor="client-phone-otp"
                              className={styles.phoneFieldLabel}
                            >
                              Verification code
                            </label>
                            <input
                              id="client-phone-otp"
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              className={styles.phoneFieldInputOtp}
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
                          </div>
                        )}

                        {phoneError && (
                          <p className={styles.fieldError} role="alert">
                            {phoneError}
                          </p>
                        )}

                        {!otpSent ? (
                          <div className={styles.phoneActionRow}>
                            <button
                              type="button"
                              className={styles.phonePrimaryBtn}
                              onClick={() => void sendPhoneCode()}
                              disabled={
                                phoneLoading ||
                                !isValidNorthAmericanPhone(pendingPhone)
                              }
                            >
                              {phoneLoading ? "Sending…" : "Send code"}
                            </button>
                            <button
                              type="button"
                              className={styles.phoneGhostBtn}
                              onClick={resetPhoneChange}
                              disabled={phoneLoading}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.phonePrimaryBtnFull}
                              onClick={() => void verifyPhoneCode()}
                              disabled={phoneLoading || otpCode.length !== 6}
                            >
                              {phoneLoading
                                ? "Verifying…"
                                : "Verify and update"}
                            </button>
                            <div className={styles.phoneSecondaryRow}>
                              <button
                                type="button"
                                className={styles.phoneTextBtn}
                                onClick={() => void sendPhoneCode()}
                                disabled={phoneLoading}
                              >
                                Resend code
                              </button>
                              <button
                                type="button"
                                className={styles.phoneTextBtn}
                                onClick={resetPhoneChange}
                                disabled={phoneLoading}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
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
                        disabled={profileSaving || !profileNamesDirty}
                        onClick={() => void handleProfileSave()}
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
              <div className={styles.cardBody}>
                <p className={styles.passwordHint}>
                  We&apos;ll email you a link to set a new password.
                </p>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={() => void sendPasswordReset()}
                  disabled={resetLoading || resetSent || !profile?.email}
                >
                  {resetLoading
                    ? "Sending…"
                    : resetSent
                      ? "Email sent"
                      : "Send reset link"}
                </button>
              </div>
            </div>

            <div className={`${styles.card} ${styles.dangerCard}`}>
              <div className={styles.dangerRow}>
                <div>
                  <div className={styles.dangerTitle}>Delete account</div>
                  <div className={styles.dangerDesc}>
                    Permanent. No grace period and no way to restore your
                    account. Profile, cards, and preferences go away. Reviews
                    you posted keep the name you chose.
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setDeleteAccountOpen(true)}
                >
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
            {prefLoading ? (
              <div aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={styles.prefCard}>
                    <div className={styles.prefHeader}>
                      <Skeleton width={180} height={15} radius={6} />
                      <Skeleton width={20} height={20} radius={6} />
                    </div>
                    <div className={styles.prefAnswers}>
                      <Skeleton width={84} height={26} radius={999} />
                      <Skeleton width={112} height={26} radius={999} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              CLIENT_PREFERENCE_QUESTIONS.map((q) => {
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
                        aria-label={isEditing ? "Done editing" : "Edit answers"}
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
                          <span className={styles.unanswered}>
                            Not answered
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <button
              type="button"
              className={styles.saveBtn}
              disabled={prefLoading || prefSaving || !prefsDirty}
              onClick={() => void handlePrefSave()}
            >
              {prefSaving ? "Saving…" : "Save preferences"}
            </button>
          </div>
        )}

        {/* Payment */}
        {tab === "payment" && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Saved cards</div>
              <div className={styles.cardBody}>
                {cardsError && (
                  <p className={styles.channelError} role="alert">
                    {cardsError}
                  </p>
                )}
                {cardsLoading ? (
                  <div className={styles.cardList} aria-busy="true">
                    {[0, 1].map((i) => (
                      <div key={i} className={styles.paymentRow}>
                        <div className={styles.paymentRowLeft}>
                          <Skeleton width={18} height={18} radius={4} />
                          <div className={styles.paymentInfo}>
                            <Skeleton width={140} height={14} radius={6} />
                            <Skeleton
                              width={88}
                              height={12}
                              radius={6}
                              style={{ marginTop: 6 }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : cards.length === 0 ? (
                  <div className={styles.paymentEmptyPanel}>
                    <CreditCard
                      size={32}
                      className={styles.cardsEmptyIcon}
                      strokeWidth={1.5}
                    />
                    <p className={styles.cardsEmptyText}>No cards saved yet</p>
                    <p className={styles.cardsEmptyDesc}>
                      Add one to check out faster next time.
                    </p>
                    <button
                      type="button"
                      className={styles.paymentEmptyCta}
                      onClick={addCard}
                    >
                      <Plus size={15} />
                      Add a card
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.cardList}>
                      {cards.map((card) =>
                        confirmDeleteId === card.id ? (
                          <div
                            key={card.id}
                            className={styles.deleteConfirmRow}
                          >
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
                                onClick={() => void removeCard(card.id)}
                                disabled={removingCardId === card.id}
                              >
                                {removingCardId === card.id
                                  ? "Removing…"
                                  : "Remove"}
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
                      className={styles.addCardLink}
                      onClick={addCard}
                    >
                      <Plus size={15} />
                      Add another card
                    </button>
                  </>
                )}
                <p className={styles.paymentTrustNote}>
                  <Lock
                    size={13}
                    className={styles.paymentTrustIcon}
                    aria-hidden
                  />
                  Cards are stored securely by Stripe and used at checkout.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {tab === "notifications" && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Notifications</div>
              {notifLoading ? (
                <div aria-busy="true">
                  {[0, 1].map((i) => (
                    <div key={i} className={styles.notifRow}>
                      <div className={styles.notifInfo}>
                        <Skeleton width={130} height={14} radius={6} />
                        <Skeleton
                          width="80%"
                          height={12}
                          radius={6}
                          style={{ marginTop: 8 }}
                        />
                      </div>
                      <Skeleton width={44} height={26} radius={999} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className={styles.notifRow}>
                    <div className={styles.notifInfo}>
                      <span className={styles.notifLabel}>Order updates</span>
                      <span className={styles.notifDesc}>
                        {orderUpdatesOn
                          ? orderUpdatesDesc
                            ? `Status changes and pickup reminders via ${orderUpdatesDesc}.`
                            : "Turn on email or SMS below to receive order updates."
                          : "You will not receive order status notifications. Check the app so you do not miss pickup or delivery steps."}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggle} ${orderUpdatesOn ? styles.toggleOn : ""}`}
                      onClick={() => {
                        setOrderUpdatesOffConfirm(false);
                        setNotifPrefs((prev) => ({
                          ...prev,
                          notifs: {
                            ...prev.notifs,
                            order_updates: !prev.notifs.order_updates,
                          },
                        }));
                      }}
                      aria-label={
                        orderUpdatesOn
                          ? "Disable order updates"
                          : "Enable order updates"
                      }
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                  </div>
                  <div className={styles.notifRow}>
                    <div className={styles.notifInfo}>
                      <span className={styles.notifLabel}>Tips & updates</span>
                      <span className={styles.notifDesc}>
                        Occasional news about new cooks, features, and
                        promotions via your enabled channels.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggle} ${notifPrefs.notifs.marketing ? styles.toggleOn : ""}`}
                      onClick={() =>
                        setNotifPrefs((prev) => ({
                          ...prev,
                          notifs: {
                            ...prev.notifs,
                            marketing: !prev.notifs.marketing,
                          },
                        }))
                      }
                      aria-label={
                        notifPrefs.notifs.marketing
                          ? "Disable tips and updates"
                          : "Enable tips and updates"
                      }
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Communication channels */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>How we reach you</div>
              <p className={styles.cardDesc}>
                Keep at least one channel on. When order updates are enabled, we
                use every channel you leave on.
              </p>
              {notifLoading ? (
                <div aria-busy="true">
                  {[0, 1].map((i) => (
                    <div key={i} className={styles.notifRow}>
                      <div className={styles.notifInfo}>
                        <Skeleton width={90} height={14} radius={6} />
                        <Skeleton
                          width="75%"
                          height={12}
                          radius={6}
                          style={{ marginTop: 8 }}
                        />
                      </div>
                      <Skeleton width={44} height={26} radius={999} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className={styles.notifRow}>
                    <div className={styles.notifInfo}>
                      <span className={styles.notifLabel}>SMS</span>
                      <span className={styles.notifDesc}>
                        {smsChannelOn && orderUpdatesOn
                          ? phoneVerified && phoneDisplay
                            ? `Order updates will be texted to ${phoneDisplay}.`
                            : "Add and verify a phone number in Profile to receive texts."
                          : smsChannelOn
                            ? "Texts for tips and promotions when you have a verified phone."
                            : "SMS is off. You will not receive text notifications."}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggle} ${smsChannelOn ? styles.toggleOn : ""} ${
                        smsChannelOn && !notifPrefs.channels.email
                          ? styles.toggleDisabled
                          : ""
                      }`}
                      disabled={smsChannelOn && !notifPrefs.channels.email}
                      onClick={() => {
                        const next = {
                          ...notifPrefs.channels,
                          sms: !smsChannelOn,
                        };
                        if (next.sms || next.email) {
                          setNotifPrefs((prev) => ({
                            ...prev,
                            channels: next,
                          }));
                        }
                      }}
                      aria-label={smsChannelOn ? "Disable SMS" : "Enable SMS"}
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                  </div>
                  <div className={styles.notifRow}>
                    <div className={styles.notifInfo}>
                      <span className={styles.notifLabel}>Email</span>
                      <span className={styles.notifDesc}>
                        {emailChannelOn && orderUpdatesOn
                          ? `Order updates will be emailed to ${profile?.email ?? "your account email"}.`
                          : emailChannelOn
                            ? "Emails for tips, receipts, and account notices."
                            : "Email is off. You will not receive email notifications."}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.toggle} ${emailChannelOn ? styles.toggleOn : ""} ${
                        emailChannelOn && !notifPrefs.channels.sms
                          ? styles.toggleDisabled
                          : ""
                      }`}
                      disabled={emailChannelOn && !notifPrefs.channels.sms}
                      onClick={() => {
                        const next = {
                          ...notifPrefs.channels,
                          email: !emailChannelOn,
                        };
                        if (next.sms || next.email) {
                          setNotifPrefs((prev) => ({
                            ...prev,
                            channels: next,
                          }));
                        }
                      }}
                      aria-label={
                        emailChannelOn ? "Disable email" : "Enable email"
                      }
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                  </div>
                </>
              )}
              {!atLeastOneChannel && (
                <p className={styles.channelError}>
                  At least one channel must stay enabled.
                </p>
              )}
            </div>

            {/* Save notifications button */}
            <div className={styles.cardFooter}>
              {orderUpdatesOffConfirm && (
                <div className={styles.subCancelConfirm}>
                  <div className={styles.subCancelConfirmText}>
                    <span className={styles.subCancelConfirmTitle}>
                      Turn off order updates?
                    </span>
                    <span className={styles.subCancelConfirmPolicy}>
                      You will not get texts or emails when your order status
                      changes. Open the app and check My orders so you do not
                      miss pickup codes or delivery steps.
                    </span>
                  </div>
                  <div className={styles.subCancelConfirmActions}>
                    <button
                      type="button"
                      className={styles.subCancelKeep}
                      onClick={() => setOrderUpdatesOffConfirm(false)}
                    >
                      Keep updates on
                    </button>
                    <button
                      type="button"
                      className={styles.subCancelConfirmBtn}
                      onClick={() => void handleNotifSave(notifPrefs)}
                      disabled={notifSaving}
                    >
                      {notifSaving ? "Saving…" : "Save without updates"}
                    </button>
                  </div>
                </div>
              )}
              {notifSaveError && (
                <p className={styles.channelError}>{notifSaveError}</p>
              )}
              {notifSaveSuccess && (
                <p className={styles.saveSuccessMsg}>
                  Notification preferences saved.
                </p>
              )}
              {!orderUpdatesOffConfirm && (
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={
                    notifSaving ||
                    notifLoading ||
                    !notifsDirty ||
                    !atLeastOneChannel
                  }
                  onClick={requestNotifSave}
                >
                  {notifSaving ? "Saving…" : "Save notifications"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showAddCard && (
        <AddCardModal
          userEmail={profile?.email ?? null}
          onSaved={handleCardSaved}
          onClose={() => setShowAddCard(false)}
        />
      )}

      {deleteAccountOpen && (
        <DeleteAccountModal
          onClose={() => setDeleteAccountOpen(false)}
          onDeleted={(redirect) => {
            setDeleteAccountOpen(false);
            router.push(redirect);
          }}
        />
      )}
    </div>
  );
}
