"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "../_skeleton";
import styles from "./PreferenceSheet.module.css";

// Read-only client preference sheet. Opened from an order or a conversation; the
// cook-scoped API enforces that the cook may only view clients they do business
// with. There is no edit affordance — the business side can only view.

type Preferences = {
  dietary: string[];
  allergies: string[];
  goals: string[];
  whyMealPrep: string[];
  hasPreferences: boolean;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; prefs: Preferences };

const SECTIONS: {
  key: "dietary" | "allergies" | "goals" | "whyMealPrep";
  label: string;
}[] = [
  { key: "dietary", label: "Dietary" },
  { key: "allergies", label: "Allergies" },
  { key: "goals", label: "Goals" },
  { key: "whyMealPrep", label: "Why they meal prep" },
];

const SKELETON_SECTIONS = [
  { id: "dietary", labelWidth: "28%", chips: [72, 88, 64] },
  { id: "allergies", labelWidth: "34%", chips: [96, 80] },
  { id: "goals", labelWidth: "28%", chips: [70, 84, 56] },
  { id: "whyMealPrep", labelWidth: "34%", chips: [100, 76] },
] as const;

function PreferenceSheetSkeleton() {
  return (
    <>
      {SKELETON_SECTIONS.map((section) => (
        <section key={section.id} className={styles.section} aria-hidden="true">
          <Skeleton width={section.labelWidth} height={11} radius={6} />
          <div className={styles.chips}>
            {section.chips.map((w) => (
              <Skeleton key={w} width={w} height={30} radius={999} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function PreferenceSheet({
  clientId,
  clientName,
  open,
  onClose,
}: {
  clientId: string | null;
  clientName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fetch preferences each time the sheet opens for a client.
  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/business/clients/${clientId}/preferences`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load preferences.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setState({ status: "ready", prefs: json.data });
      })
      .catch(() => {
        if (!cancelled)
          setState({
            status: "error",
            message: "Could not load preferences.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close preferences"
        className={styles.backdrop}
        onClick={onClose}
      />
      <aside
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`${clientName}'s preferences`}
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>Preferences</p>
            <h2 className={styles.title}>{clientName}</h2>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body} aria-busy={state.status === "loading"}>
          {state.status === "loading" && <PreferenceSheetSkeleton />}

          {state.status === "error" && (
            <p className={styles.error}>{state.message}</p>
          )}

          {state.status === "ready" &&
            (!state.prefs.hasPreferences ? (
              <p className={styles.muted}>
                They haven&apos;t shared any preferences yet.
              </p>
            ) : (
              SECTIONS.map(({ key, label }) => {
                const items = state.prefs[key];
                return (
                  <section key={key} className={styles.section}>
                    <h3 className={styles.sectionLabel}>{label}</h3>
                    {items.length > 0 ? (
                      <div className={styles.chips}>
                        {items.map((item) => (
                          <span key={item} className={styles.chip}>
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.none}>None specified</p>
                    )}
                  </section>
                );
              })
            ))}
        </div>

        <p className={styles.footnote}>Read-only · set by the client</p>
      </aside>
    </>
  );
}
