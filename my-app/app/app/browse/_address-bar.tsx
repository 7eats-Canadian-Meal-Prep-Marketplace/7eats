"use client";

import { MapPin, X } from "lucide-react";
import { useState } from "react";
import { useGuestAddress } from "@/lib/hooks/use-guest-address";
import styles from "./_address-bar.module.css";

type Props = { isLoggedIn: boolean };

export function AddressBar({ isLoggedIn }: Props) {
  const { guestAddress, setGuestAddress } = useGuestAddress();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Logged-in users don't need this — their address comes from their account
  if (isLoggedIn) return null;
  if (dismissed && !guestAddress) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/address/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: input.trim() }),
      });
      const json = (await res.json()) as {
        data?: { lat: number; lng: number };
        error?: string;
      };
      if (!res.ok || !json.data) {
        setError(json.error ?? "Address not found. Try adding your city.");
        return;
      }
      setGuestAddress({
        displayText: input.trim(),
        street: input.trim(),
        unit: "",
        city: "",
        province: "ON",
        postal: "",
        lat: json.data.lat,
        lng: json.data.lng,
      });
      setOpen(false);
      setInput("");
    } catch {
      setError("Could not look up address. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.bar}>
      <MapPin size={15} className={styles.pin} />
      {guestAddress ? (
        <>
          <span className={styles.addressText}>{guestAddress.displayText}</span>
          <button
            type="button"
            className={styles.changeBtn}
            onClick={() => {
              setOpen(true);
              setInput(guestAddress.displayText);
            }}
          >
            Change
          </button>
        </>
      ) : (
        <>
          <span className={styles.prompt}>
            Add your address to see delivery options near you
          </span>
          <button
            type="button"
            className={styles.enterBtn}
            onClick={() => setOpen(true)}
          >
            Enter address
          </button>
          <button
            type="button"
            className={styles.dismissBtn}
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
          >
            <X size={14} />
          </button>
        </>
      )}

      {open && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.input}
            placeholder="123 King St W, Toronto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? "Looking up…" : "Save"}
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
