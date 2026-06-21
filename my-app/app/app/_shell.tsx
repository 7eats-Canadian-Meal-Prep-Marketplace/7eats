"use client";

import {
  Check,
  ChevronDown,
  Heart,
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import {
  AddressSearchInput,
  type ResolvedAddress,
} from "@/components/AddressSearchInput";
import { OPEN_ADDRESS_EVENT } from "@/lib/address-events";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  addressesMatch,
  GuestAddressProvider,
  useGuestAddress,
} from "@/lib/hooks/use-guest-address";
import type { NormalizedAddress } from "@/lib/types/address";
import { AppProvider, useApp } from "./_app-context";
import { CartProvider, useCart } from "./_cart-context";
import {
  ServiceAddressProvider,
  useServiceAddress,
} from "./_service-address-context";
import styles from "./_shell.module.css";

type SuggestKitchen = {
  id: string;
  name: string;
  cuisines: string[];
  photoUrl: string | null;
  distanceKm: number | null;
};

type SuggestItem =
  | { kind: "term"; value: string }
  | { kind: "kitchen"; kitchen: SuggestKitchen };

function HeaderSearchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentAddress } = useServiceAddress();
  const { fulfillment } = useApp();
  const [val, setVal] = useState(searchParams.get("q") ?? "");
  const [terms, setTerms] = useState<string[]>([]);
  const [kitchens, setKitchens] = useState<SuggestKitchen[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounce(val.trim(), 200);

  useEffect(() => {
    setVal(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Fetch typo-tolerant suggestions as the user types (geo-bounded).
  useEffect(() => {
    if (debounced.length < 2 || !currentAddress) {
      setTerms([]);
      setKitchens([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: debounced,
      lat: String(currentAddress.lat),
      lng: String(currentAddress.lng),
      mode: fulfillment,
    });
    fetch(`/api/search/suggest?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        const data = json?.data ?? {};
        setTerms(Array.isArray(data.terms) ? data.terms : []);
        setKitchens(Array.isArray(data.kitchens) ? data.kitchens : []);
        setActiveIndex(-1);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setTerms([]);
          setKitchens([]);
        }
      });
    return () => controller.abort();
  }, [debounced, currentAddress, fulfillment]);

  const items: SuggestItem[] = [
    ...terms.map((t) => ({ kind: "term" as const, value: t })),
    ...kitchens.map((k) => ({ kind: "kitchen" as const, kitchen: k })),
  ];
  const showDropdown = open && val.trim().length >= 2 && items.length > 0;

  useEffect(() => {
    if (!showDropdown) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showDropdown]);

  function pushSearch(q: string) {
    const params = new URLSearchParams();
    const trimmed = q.trim();
    if (trimmed) params.set("q", trimmed);
    // Cuisine pills are standalone quick searches — a typed keyword replaces the
    // active cuisine rather than stacking on top of it. Carry only the sort.
    const sort = searchParams.get("sort");
    if (sort && sort !== "nearest") params.set("sort", sort);
    const qs = params.toString();
    setOpen(false);
    router.push(qs ? `/app/search?${qs}` : "/app/search");
  }

  function selectItem(item: SuggestItem) {
    if (item.kind === "term") {
      setVal(item.value);
      pushSearch(item.value);
    } else {
      setOpen(false);
      router.push(`/app/cooks/${item.kitchen.id}/menu`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        selectItem(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.headerSearchWrap} ref={wrapRef}>
      <form
        className={styles.headerSearch}
        onSubmit={(e) => {
          e.preventDefault();
          pushSearch(val);
        }}
      >
        <Search size={16} className={styles.headerSearchIcon} />
        <input
          className={styles.headerSearchInput}
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search cooks, dishes, cuisines…"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="header-suggest-list"
        />
      </form>

      {showDropdown && (
        <div
          id="header-suggest-list"
          className={styles.suggestMenu}
          role="listbox"
        >
          {terms.length > 0 && (
            <div className={styles.suggestSection}>
              {terms.map((t, i) => (
                <button
                  key={`term-${t}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === i}
                  className={`${styles.suggestTerm} ${activeIndex === i ? styles.suggestActive : ""}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectItem({ kind: "term", value: t })}
                >
                  <Search size={13} className={styles.suggestTermIcon} />
                  {t}
                </button>
              ))}
            </div>
          )}
          {kitchens.length > 0 && (
            <div className={styles.suggestSection}>
              {kitchens.map((k, i) => {
                const idx = terms.length + i;
                return (
                  <button
                    key={`kitchen-${k.id}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`${styles.suggestKitchen} ${activeIndex === idx ? styles.suggestActive : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectItem({ kind: "kitchen", kitchen: k })}
                  >
                    <span className={styles.suggestThumb}>
                      {k.photoUrl ? (
                        // biome-ignore lint/performance/noImgElement: tiny suggestion thumb
                        <img src={k.photoUrl} alt="" />
                      ) : null}
                    </span>
                    <span className={styles.suggestKitchenText}>
                      <span className={styles.suggestKitchenName}>
                        {k.name}
                      </span>
                      {(k.cuisines.length > 0 || k.distanceKm != null) && (
                        <span className={styles.suggestKitchenMeta}>
                          {[
                            k.cuisines.slice(0, 2).join(" · "),
                            k.distanceKm != null ? `${k.distanceKm} km` : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FulfillmentToggle({ className = "" }: { className?: string }) {
  const { fulfillment, setFulfillment } = useApp();
  return (
    <div className={`${styles.segmented} ${className}`}>
      <button
        type="button"
        className={`${styles.segment} ${fulfillment === "pickup" ? styles.segmentActive : ""}`}
        onClick={() => setFulfillment("pickup")}
      >
        Pickup
      </button>
      <button
        type="button"
        className={`${styles.segment} ${fulfillment === "delivery" ? styles.segmentActive : ""}`}
        onClick={() => setFulfillment("delivery")}
      >
        Delivery
      </button>
    </div>
  );
}

function AddressModal({
  mandatory,
  onAdd,
  onClose,
}: {
  /** When true the modal can't be dismissed — an address must be set first. */
  mandatory: boolean;
  onAdd: (a: ResolvedAddress) => void | Promise<void>;
  onClose: () => void;
}) {
  const [street, setStreet] = useState("");
  const [pending, setPending] = useState<ResolvedAddress | null>(null);
  const [saving, setSaving] = useState(false);

  // A pick only counts once every field resolved — a partial Mapbox result
  // (missing postal/place id/coords) must not be confirmable.
  const complete =
    pending != null &&
    !!pending.streetAddress &&
    !!pending.city &&
    !!pending.province &&
    !!pending.postalCode &&
    pending.lat != null &&
    pending.lng != null &&
    !!pending.placeId;

  async function confirm() {
    if (!complete || !pending) return;
    setSaving(true);
    try {
      await onAdd(pending);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss
    <div className={styles.backdrop} onClick={mandatory ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={styles.addrModal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={styles.addrModalHead}>
          <span className={styles.addrModalTitle}>
            {mandatory ? "Set your delivery address" : "Add an address"}
          </span>
          {!mandatory && (
            <button
              type="button"
              className={styles.addrModalClose}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className={styles.addrModalBody}>
          <AddressSearchInput
            id="shell-address"
            className={styles.addrInput}
            value={street}
            onTextChange={(t) => {
              setStreet(t);
              setPending(null);
            }}
            onResolve={(a) => {
              setStreet(a.streetAddress);
              setPending(a);
            }}
          />
          <p className={styles.addrModalHint}>
            {pending && complete
              ? [
                  pending.streetAddress,
                  pending.city,
                  pending.province,
                  pending.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")
              : "Select a complete address from the suggestions."}
          </p>
        </div>
        <div className={styles.addrModalFoot}>
          <button
            type="button"
            className={styles.addrConfirmBtn}
            disabled={!complete || saving}
            onClick={confirm}
          >
            {saving ? "Saving…" : "Confirm address"}
          </button>
        </div>
      </div>
    </div>
  );
}

const MENU_LINKS = [
  { href: "/app/search", label: "Search", Icon: Search },
  { href: "/app/saved", label: "Favourites", Icon: Heart },
  { href: "/app/orders", label: "Orders", Icon: Package },
  { href: "/app/subscriptions", label: "Subscriptions", Icon: RefreshCw },
  { href: "/app/settings", label: "Account", Icon: Settings },
];

function ProfileMenu({
  initials,
  name,
  email,
}: {
  initials: string;
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function handleSignOut() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/sign-out", { method: "POST" });
        const data = await res.json();
        router.push(data.redirect ?? "/app-auth/login");
      } catch {
        router.push("/app-auth/login");
      }
    });
  }

  return (
    <div className={styles.profileWrap} ref={ref}>
      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <div className={styles.menuAvatar}>{initials}</div>
            <div className={styles.menuIdentity}>
              <span className={styles.menuName}>{name || "Your account"}</span>
              <span className={styles.menuEmail}>{email}</span>
            </div>
          </div>
          <div className={styles.menuDivider} />
          {MENU_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={styles.menuItem}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Icon size={17} className={styles.menuIcon} />
              {label}
            </Link>
          ))}
          <div className={styles.menuDivider} />
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={handleSignOut}
            disabled={isPending}
          >
            <LogOut size={17} className={styles.menuIcon} />
            {isPending ? "Signing out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}

const BOTTOM_NAV = [
  {
    href: "/app/search",
    label: "Search",
    Icon: Search,
    requiresAuth: false,
  },
  { href: "/app/orders", label: "Orders", Icon: Package, requiresAuth: true },
  { href: "/app/settings", label: "Account", Icon: User, requiresAuth: true },
];

function ShellInner({
  children,
  isLoggedIn,
  userInitials,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  userInitials: string;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const { totalQuantity } = useCart();
  const { setProvince } = useApp();
  const guest = useGuestAddress();
  const { ready, currentAddress, setServerAddress } = useServiceAddress();
  const [showAddress, setShowAddress] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const addressDropdownRef = useRef<HTMLDivElement>(null);

  // Let other parts of the app (e.g. the browse empty state) open the address
  // editor without threading a callback through context.
  useEffect(() => {
    const open = () => setShowAddress(true);
    window.addEventListener(OPEN_ADDRESS_EVENT, open);
    return () => window.removeEventListener(OPEN_ADDRESS_EVENT, open);
  }, []);

  const savedOptions: { id: string; label: string; active: boolean }[] =
    isLoggedIn
      ? currentAddress
        ? [
            {
              id: "current",
              label: currentAddress.street.split(",")[0],
              active: true,
            },
          ]
        : []
      : guest.addresses.map((a) => ({
          id: a.id,
          label: a.street.split(",")[0] || a.city,
          active: a.id === guest.selected?.id,
        }));

  // Mandatory address gate: on browse/search, force a (non-dismissable) modal
  // until a location exists — guests can't search with an undefined location.
  const onGatePage = pathname === "/app/browse" || pathname === "/app/search";
  const mustSetAddress = onGatePage && ready && currentAddress === null;

  async function handleAddAddress(a: ResolvedAddress) {
    if (isLoggedIn) {
      const normalized: NormalizedAddress = {
        street: a.streetAddress,
        unit: undefined,
        city: a.city,
        province: a.province,
        postal: a.postalCode,
        lat: a.lat,
        lng: a.lng,
        placeId: a.placeId,
      };
      if (
        currentAddress &&
        addressesMatch(
          {
            placeId: currentAddress.placeId,
            street: currentAddress.street,
            postal: currentAddress.postal,
            lat: currentAddress.lat,
            lng: currentAddress.lng,
          },
          {
            placeId: normalized.placeId,
            street: normalized.street,
            postal: normalized.postal,
            lat: normalized.lat,
            lng: normalized.lng,
          },
        )
      ) {
        setShowAddress(false);
        return;
      }
      setServerAddress(normalized);
      setProvince(normalized.province);
      try {
        await fetch("/api/user/address", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...normalized, unit: null }),
        });
      } catch {
        // Non-critical — address is already updated in local state
      }
    } else {
      guest.addAddress({
        street: a.streetAddress,
        unit: "",
        city: a.city,
        province: a.province,
        postal: a.postalCode,
        lat: a.lat,
        lng: a.lng,
        placeId: a.placeId,
      });
      setProvince(a.province);
    }
  }

  useEffect(() => {
    if (!showAddressDropdown) return;
    function onDocClick(e: MouseEvent) {
      if (
        addressDropdownRef.current &&
        !addressDropdownRef.current.contains(e.target as Node)
      ) {
        setShowAddressDropdown(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setShowAddressDropdown(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [showAddressDropdown]);

  const isOnboarding = pathname.startsWith("/app-auth/onboarding");
  const isCheckout = pathname.startsWith("/app/checkout");
  const showFulfillmentToggle =
    pathname === "/app/browse" || pathname === "/app/search";
  const hideBottomNav = isOnboarding || isCheckout;

  const visibleBottomNav = isLoggedIn
    ? BOTTOM_NAV
    : BOTTOM_NAV.filter((item) => !item.requiresAuth);

  return (
    <div className={styles.shell}>
      {!isOnboarding && (
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/app/browse" className={styles.brandLink}>
              <Image
                src="/7eats-logo.svg"
                alt="7eats"
                width={64}
                height={36}
                priority
              />
            </Link>

            {showFulfillmentToggle && (
              <FulfillmentToggle className={styles.headerSegmented} />
            )}

            <Suspense
              fallback={<div className={styles.headerSearchFallback} />}
            >
              <HeaderSearchInner />
            </Suspense>

            <div className={styles.addressWrap} ref={addressDropdownRef}>
              <button
                type="button"
                className={`${styles.addressChip} ${showAddressDropdown ? styles.addressChipOpen : ""}`}
                onClick={() => setShowAddressDropdown((o) => !o)}
              >
                <MapPin size={14} />
                <span className={styles.addressChipText}>
                  {currentAddress
                    ? currentAddress.street.split(",")[0]
                    : "Add address"}
                </span>
                <ChevronDown size={12} className={styles.addressChevron} />
              </button>

              {showAddressDropdown && (
                <div className={styles.addressDropdown}>
                  {savedOptions.map((opt) => (
                    <div
                      key={opt.id}
                      className={`${styles.addressOption} ${opt.active ? styles.addressOptionActive : ""}`}
                    >
                      <button
                        type="button"
                        className={styles.addressOptionMain}
                        onClick={() => {
                          if (!isLoggedIn) guest.selectAddress(opt.id);
                          setShowAddressDropdown(false);
                        }}
                      >
                        <MapPin
                          size={13}
                          className={styles.addressOptionIcon}
                        />
                        <span>{opt.label}</span>
                        {opt.active && (
                          <Check
                            size={13}
                            className={styles.addressOptionCheck}
                          />
                        )}
                      </button>
                      {!isLoggedIn && guest.addresses.length > 1 && (
                        <button
                          type="button"
                          className={styles.addressOptionDelete}
                          aria-label="Remove address"
                          onClick={() => guest.removeAddress(opt.id)}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {savedOptions.length > 0 && (
                    <div className={styles.addressDropdownDivider} />
                  )}
                  <button
                    type="button"
                    className={`${styles.addressOption} ${styles.addressOptionAdd}`}
                    onClick={() => {
                      setShowAddressDropdown(false);
                      setShowAddress(true);
                    }}
                  >
                    <Plus size={13} className={styles.addressOptionIcon} />
                    <span>
                      {currentAddress ? "Add another address" : "Add address"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className={styles.headerRight}>
              <Link
                href="/app/cart"
                className={styles.cartPill}
                aria-label={`Cart, ${totalQuantity} item${totalQuantity === 1 ? "" : "s"}`}
              >
                <ShoppingCart size={18} strokeWidth={2} />
                <span className={styles.cartCount}>{totalQuantity}</span>
              </Link>

              {isLoggedIn ? (
                <ProfileMenu
                  initials={userInitials}
                  name={userName}
                  email={userEmail}
                />
              ) : (
                <div className={styles.guestActions}>
                  <Link href="/app-auth/login" className={styles.loginBtn}>
                    Log in
                  </Link>
                  <Link href="/app-auth/signup" className={styles.signupBtn}>
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main
        className={`${styles.main} ${isOnboarding ? styles.mainOnboarding : ""}`}
      >
        {children}
      </main>

      {(showAddress || mustSetAddress) && (
        <AddressModal
          mandatory={mustSetAddress}
          onAdd={handleAddAddress}
          onClose={() => setShowAddress(false)}
        />
      )}

      {!hideBottomNav && (
        <nav className={styles.bottomNav} aria-label="Mobile navigation">
          {visibleBottomNav.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.bottomNavItem} ${active ? styles.bottomNavItemActive : ""}`}
              >
                <span className={styles.bottomNavIconWrap}>
                  <Icon size={22} />
                </span>
                <span className={styles.bottomNavLabel}>{label}</span>
              </Link>
            );
          })}
          {!isLoggedIn && (
            <Link href="/app-auth/login" className={styles.bottomNavItem}>
              <span className={styles.bottomNavIconWrap}>
                <User size={22} />
              </span>
              <span className={styles.bottomNavLabel}>Log in</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export default function AppShell({
  children,
  isLoggedIn,
  userInitials = "",
  userName = "",
  userEmail = "",
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  userInitials?: string;
  userName?: string;
  userEmail?: string;
}) {
  return (
    <AppProvider
      isLoggedIn={isLoggedIn}
      userName={userName}
      userEmail={userEmail}
    >
      <CartProvider>
        <GuestAddressProvider>
          <ServiceAddressProvider isLoggedIn={isLoggedIn}>
            <ShellInner
              isLoggedIn={isLoggedIn}
              userInitials={userInitials}
              userName={userName}
              userEmail={userEmail}
            >
              {children}
            </ShellInner>
          </ServiceAddressProvider>
        </GuestAddressProvider>
      </CartProvider>
    </AppProvider>
  );
}
