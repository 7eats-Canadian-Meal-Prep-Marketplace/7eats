"use client";

import { MapPin } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { openAddressEditor } from "@/lib/address/events";
import { classifyRegion } from "@/lib/service-areas";
import type { NormalizedAddress } from "@/lib/types/address";
import styles from "./page.module.css";

const JOINED_MSG =
  "You’re on the list — we’ll email you the moment 7eats reaches you.";

/**
 * Location-aware empty state for browse + search. When no reachable kitchens
 * turn up, we read the service address and tell the user where 7eats stands
 * relative to it. Anywhere in Canada we're genuinely expanding toward, the
 * primary action is a waitlist signup (email captured against their city);
 * outside Canada there's nothing to wait for, so we ask for a Canadian address.
 */
export function BrowseEmpty({
  address,
}: {
  address: NormalizedAddress | null;
}) {
  const region = address ? classifyRegion(address) : null;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  let title: string;
  let desc = "";

  if (region?.kind === "active-province") {
    title = `7eats is coming to ${region.place} soon`;
    desc =
      "Join the waitlist and we'll let you know the moment home cooks near you go live.";
  } else if (region?.kind === "other-province") {
    title = `7eats is coming to ${region.place} soon`;
    desc = `We're expanding across Canada one neighbourhood at a time. Join the waitlist and we'll tell you when we reach ${region.place}.`;
  } else if (region?.kind === "outside-canada") {
    title = "7eats is Canada-only for now";
    desc =
      "We're serving home-cooked meals across Canada. Enter a Canadian address to start exploring meal prep services near you.";
  } else {
    title = "No meal prep services nearby yet";
    desc =
      "We couldn't find home cooks near you just yet. Join the waitlist and we'll reach out when that changes.";
  }

  // Waitlist only makes sense where we can actually expand to — i.e. anywhere in
  // Canada (named region) or an unresolved address. Outside Canada we can't
  // promise to come, so the action is to enter a Canadian address instead.
  const showWaitlist = region?.kind !== "outside-canada";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ...(address?.city ? { city: address.city } : {}),
        }),
      });
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    setLoading(false);

    if (res.ok) {
      setJoined(true);
      toast.success("You're on the list! We'll be in touch.");
      return;
    }
    if (res.status === 409) {
      setJoined(true);
      toast.info("You're already on the list.");
      return;
    }
    if (res.status === 429) {
      toast.error("Too many attempts. Try again later.");
      return;
    }
    toast.error("Something went wrong. Please try again.");
  }

  return (
    <div className={styles.comingSoon}>
      <div className={styles.radar} aria-hidden="true">
        <span className={styles.radarRing} />
        <span className={styles.radarRing} />
        <span className={styles.radarRing} />
        <span className={styles.radarPin}>
          <MapPin size={26} strokeWidth={2.5} />
        </span>
      </div>
      <h2 className={styles.comingSoonTitle}>{title}</h2>
      {desc && <p className={styles.comingSoonDesc}>{desc}</p>}

      {showWaitlist ? (
        joined ? (
          <p className={styles.waitlistDone}>{JOINED_MSG}</p>
        ) : (
          <form className={styles.waitlistForm} onSubmit={handleSubmit}>
            <input
              type="email"
              required
              className={styles.waitlistInput}
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address for the waitlist"
            />
            <button
              type="submit"
              className={styles.waitlistBtn}
              disabled={loading}
            >
              {loading ? "Joining…" : "Join the waitlist"}
            </button>
          </form>
        )
      ) : (
        <button
          type="button"
          className={styles.comingSoonBtn}
          onClick={openAddressEditor}
        >
          Try another address
        </button>
      )}

      {showWaitlist && (
        <button
          type="button"
          className={styles.changeAddressLink}
          onClick={openAddressEditor}
        >
          Wrong address? Update it
        </button>
      )}
    </div>
  );
}
