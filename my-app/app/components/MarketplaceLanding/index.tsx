"use client";

import { Bike, Check, ChefHat, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useApp } from "@/app/app/_app-context";
import { useServiceAddress } from "@/app/app/_service-address-context";
import CookiePreferencesLink from "@/app/components/CookiePreferencesLink";
import { usePlatformDiscountTeaser } from "@/app/components/PlatformDiscountSignupPrompt";
import {
  AddressSearchInput,
  type ResolvedAddress,
} from "@/components/AddressSearchInput";
import { useGuestAddress } from "@/lib/hooks/use-guest-address";
import type { NormalizedAddress } from "@/lib/types/address";
import styles from "./MarketplaceLanding.module.css";

function isCompleteAddress(a: ResolvedAddress | null): a is ResolvedAddress {
  return (
    a != null &&
    !!a.streetAddress &&
    !!a.city &&
    !!a.province &&
    !!a.postalCode &&
    a.lat != null &&
    a.lng != null &&
    !!a.placeId
  );
}

function toNormalized(a: ResolvedAddress): NormalizedAddress {
  return {
    street: a.streetAddress,
    city: a.city,
    province: a.province,
    postal: a.postalCode,
    lat: a.lat,
    lng: a.lng,
    placeId: a.placeId,
  };
}

const FLOW = [
  {
    Icon: MapPin,
    title: "Cooks near you",
    desc: "See who's cooking in your area and what's on their menu this week.",
  },
  {
    Icon: ChefHat,
    title: "Made fresh for you",
    desc: "Cooks prepare your meals once you've ordered, ready for pickup or delivery on their schedule.",
  },
  {
    Icon: Bike,
    title: "Pickup or delivery",
    desc: "Collect from the cook or get it dropped off. Each kitchen sets its own windows.",
  },
] as const;

const COOK_PERKS = [
  "Paid upfront at checkout",
  "Your menu, your hours, your kitchen",
  "Payouts handled through Stripe",
] as const;

export default function MarketplaceLanding({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const { setProvince } = useApp();
  const { setServerAddress } = useServiceAddress();
  const guest = useGuestAddress();
  const teaser = usePlatformDiscountTeaser(!isLoggedIn);
  const [street, setStreet] = useState("");
  const [pending, setPending] = useState<ResolvedAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const complete = isCompleteAddress(pending);

  async function persistAddress(resolved: ResolvedAddress) {
    const normalized = toNormalized(resolved);
    setProvince(normalized.province);

    if (isLoggedIn) {
      setServerAddress(normalized);
      await fetch("/api/user/address", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...normalized, unit: null }),
      }).catch(() => {});
      return;
    }

    guest.addAddress({
      street: normalized.street,
      unit: "",
      city: normalized.city,
      province: normalized.province,
      postal: normalized.postal,
      lat: normalized.lat,
      lng: normalized.lng,
      placeId: normalized.placeId,
    });
  }

  async function goToBrowse(resolved: ResolvedAddress) {
    setSaving(true);
    try {
      await persistAddress(resolved);
      router.push("/app/browse");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    if (!complete) {
      setHint("Pick your address from the suggestions to continue.");
      return;
    }
    setHint(null);
    void goToBrowse(pending);
  }

  return (
    <div className={styles.page}>
      <div className={styles.topStack}>
        {!isLoggedIn && teaser?.available && teaser.headline && (
          <div className={styles.promoBanner}>
            <span className={styles.promoBannerMain}>{teaser.headline}</span>
            <span className={styles.promoBannerSub}>
              {teaser.qualifier ?? "New members only"}.
            </span>
            <Link href="/app-auth/signup" className={styles.promoBannerLink}>
              Sign up to claim
            </Link>
          </div>
        )}

        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <Link href="/app" className={styles.logoLink}>
              <Image
                src="/7eats-logo.svg"
                alt="7eats"
                width={72}
                height={40}
                priority
              />
            </Link>
            <div className={styles.topbarActions}>
              {isLoggedIn ? (
                <Link href="/app/browse" className={styles.topbarPrimary}>
                  Browse menus
                </Link>
              ) : (
                <>
                  <Link href="/app-auth/login" className={styles.topbarGhost}>
                    Log in
                  </Link>
                  <Link
                    href="/app-auth/signup"
                    className={styles.topbarPrimary}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
      </div>

      <section className={styles.hero} aria-labelledby="landing-headline">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 id="landing-headline" className={styles.headline}>
              Canada&apos;s first meal prep marketplace.
            </h1>
            <p className={styles.lead}>
              Find cooks near you, browse this week&apos;s menu, and pay at
              checkout. Pickup or delivery on the cook&apos;s schedule.
            </p>

            <form className={styles.searchCard} onSubmit={handleSubmit}>
              <div className={styles.searchRow}>
                <div className={styles.inputWrap}>
                  <label htmlFor="landing-address" className={styles.srOnly}>
                    Delivery address
                  </label>
                  <MapPin
                    className={styles.inputIcon}
                    size={18}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <AddressSearchInput
                    id="landing-address"
                    className={styles.addressInput}
                    placeholder="Enter your address"
                    value={street}
                    onTextChange={(t) => {
                      setStreet(t);
                      setPending(null);
                      setHint(null);
                    }}
                    onResolve={(a) => {
                      setStreet(a.streetAddress);
                      setPending(a);
                      setHint(null);
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className={styles.searchBtn}
                  disabled={saving || !complete}
                >
                  {saving ? "Loading…" : "See what's nearby"}
                </button>
              </div>
              {(hint || complete) && (
                <p
                  className={`${styles.searchHint} ${
                    hint ? styles.searchHintError : ""
                  }`}
                  aria-live="polite"
                >
                  {hint ??
                    [
                      pending?.streetAddress,
                      pending?.city,
                      pending?.province,
                      pending?.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                </p>
              )}
            </form>
          </div>

          <div className={styles.heroMedia}>
            <div className={styles.heroImageFrame}>
              <Image
                src="/hero-meals.jpg"
                alt="Trays of freshly packed meal-prep boxes from a 7eats cook"
                fill
                priority
                sizes="(min-width: 900px) 50vw, 100vw"
                className={styles.heroImage}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.expect} aria-labelledby="landing-flow">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 id="landing-flow" className={styles.sectionTitle}>
              From a local kitchen to your table
            </h2>
            <p className={styles.sectionSub}>
              Enter your address, pick from this week&apos;s menu, and choose
              pickup or delivery.
            </p>
          </div>
          <ul className={styles.expectGrid}>
            {FLOW.map(({ Icon, title, desc }) => (
              <li key={title} className={styles.expectItem}>
                <Icon
                  className={styles.expectIcon}
                  size={26}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h3 className={styles.expectTitle}>{title}</h3>
                <p className={styles.expectDesc}>{desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.cook} aria-labelledby="landing-cook">
        <div className={styles.sectionInner}>
          <div className={styles.cookPanel}>
            <p className={styles.cookEyebrow}>For cooks</p>
            <h2 id="landing-cook" className={styles.cookTitle}>
              Cook for your neighbourhood
            </h2>
            <p className={styles.cookLead}>
              List your weekly menu, take paid orders, and reach customers
              nearby. You run your kitchen on your terms.
            </p>
            <ul className={styles.cookPerks}>
              {COOK_PERKS.map((perk) => (
                <li key={perk} className={styles.cookPerk}>
                  <Check
                    className={styles.cookPerkIcon}
                    size={18}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {perk}
                </li>
              ))}
            </ul>
            <div className={styles.cookCta}>
              <Link href="/business/home" className={styles.cookCtaPrimary}>
                Start selling on 7eats
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.sectionInner}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <Image
                src="/7eats-logo.svg"
                alt="7eats"
                width={96}
                height={40}
                className={styles.footerLogo}
              />
              <p className={styles.footerTagline}>
                Canada&apos;s first meal prep marketplace. Order from
                independent kitchens near you.
              </p>
            </div>
            <div className={styles.footerCol}>
              <h4 className={styles.footerColHead}>Explore</h4>
              <ul className={styles.footerLinks}>
                <li>
                  <Link href="/app/browse">Browse menus</Link>
                </li>
                <li>
                  <Link href="/app/search?all=1">Search cooks</Link>
                </li>
                <li>
                  <a href="/help" target="_blank" rel="noopener noreferrer">
                    Help
                  </a>
                </li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4 className={styles.footerColHead}>For cooks</h4>
              <ul className={styles.footerLinks}>
                <li>
                  <Link href="/business/home">Sell on 7eats</Link>
                </li>
                <li>
                  <Link href="/business-auth/login">Cook log in</Link>
                </li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4 className={styles.footerColHead}>Legal</h4>
              <ul className={styles.footerLinks}>
                <li>
                  <Link href="/terms">Terms of service</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy policy</Link>
                </li>
                <li>
                  <Link href="/food-safety">Food safety</Link>
                </li>
                <li>
                  <Link href="/refund-policy">Refunds &amp; cancellations</Link>
                </li>
                <li>
                  <Link href="/community-guidelines">Community guidelines</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© 2026 7eats Inc. · Toronto, ON</span>
            <div className={styles.footerBottomLinks}>
              <a href="mailto:team@7eats.ca">team@7eats.ca</a>
              <CookiePreferencesLink />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
