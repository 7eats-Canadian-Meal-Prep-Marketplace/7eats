"use client";

import {
  Check,
  ChevronDown,
  Heart,
  HelpCircle,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  User,
  UserPlus,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import {
  AddressSearchInput,
  type ResolvedAddress,
} from "@/components/AddressSearchInput";
import { OPEN_ADDRESS_EVENT } from "@/lib/address/events";
import {
  addressesMatch,
  GuestAddressProvider,
  useGuestAddress,
} from "@/lib/hooks/use-guest-address";
import type { NormalizedAddress } from "@/lib/types/address";
import { profileInitials } from "@/lib/user-display";
import { AppProvider, useApp } from "./_app-context";
import { AppSearchInput } from "./_app-search";
import {
  CartAddressGuardProvider,
  useCartAddressGuard,
} from "./_cart-address-guard";
import { CartProvider, useCart } from "./_cart-context";
import {
  ServiceAddressProvider,
  useServiceAddress,
} from "./_service-address-context";
import styles from "./_shell.module.css";

export function FulfillmentToggle({ className = "" }: { className?: string }) {
  const { fulfillmentMode, setFulfillment } = useCart();
  return (
    <div className={`${styles.segmented} ${className}`}>
      <button
        type="button"
        className={`${styles.segment} ${fulfillmentMode === "pickup" ? styles.segmentActive : ""}`}
        onClick={() => setFulfillment("pickup")}
      >
        Pickup
      </button>
      <button
        type="button"
        className={`${styles.segment} ${fulfillmentMode === "delivery" ? styles.segmentActive : ""}`}
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

const PROFILE_MENU_LINKS = [
  {
    href: "/app/search?all=1",
    label: "Search",
    Icon: Search,
    desktopOnly: true,
  },
  { href: "/app/saved", label: "Favourites", Icon: Heart, desktopOnly: true },
  { href: "/app/orders", label: "Orders", Icon: Package, desktopOnly: true },
  {
    href: "/app/settings",
    label: "Account",
    Icon: Settings,
    desktopOnly: true,
  },
] as const;

function ProfileMenu({
  initials,
  imageUrl,
  name,
  email,
}: {
  initials: string;
  imageUrl: string | null;
  name: string;
  email: string;
}) {
  const displayInitials =
    initials !== "?"
      ? initials
      : profileInitials(undefined, undefined, name, email);
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
        router.push(data.redirect ?? "/app/browse");
        router.refresh();
      } catch {
        router.push("/app/browse");
        router.refresh();
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
        {imageUrl ? (
          // biome-ignore lint/performance/noImgElement: CDN avatar
          <img
            key={imageUrl}
            src={imageUrl}
            alt=""
            className={styles.avatarBtnImg}
          />
        ) : (
          <span key="initials">{displayInitials}</span>
        )}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <div className={styles.menuAvatar}>
              {imageUrl ? (
                // biome-ignore lint/performance/noImgElement: CDN avatar
                <img
                  key={imageUrl}
                  src={imageUrl}
                  alt=""
                  className={styles.menuAvatarImg}
                />
              ) : (
                <span key="initials">{displayInitials}</span>
              )}
            </div>
            <div className={styles.menuIdentity}>
              <span className={styles.menuName}>{name || "Your account"}</span>
              <span className={styles.menuEmail}>{email}</span>
            </div>
          </div>
          <div className={styles.menuDivider} />
          {PROFILE_MENU_LINKS.map(({ href, label, Icon, desktopOnly }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.menuItem} ${desktopOnly ? styles.menuItemDesktopOnly : ""}`}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Icon size={17} className={styles.menuIcon} />
              {label}
            </Link>
          ))}
          <a
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <HelpCircle size={17} className={styles.menuIcon} />
            Help
          </a>
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

const BOTTOM_NAV_LOGGED_IN = [
  { href: "/app/search?all=1", label: "Search", Icon: Search },
  { href: "/app/saved", label: "Favourites", Icon: Heart },
  { href: "/app/orders", label: "Orders", Icon: Package },
  { href: "/app/settings", label: "Account", Icon: User },
] as const;

const BOTTOM_NAV_GUEST = [
  { href: "/app/search?all=1", label: "Search", Icon: Search },
  { href: "/app-auth/login", label: "Log in", Icon: LogIn },
  { href: "/app-auth/signup", label: "Sign up", Icon: UserPlus },
] as const;

function ShellInner({
  children,
  isLoggedIn,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const { totalQuantity } = useCart();
  const { setProvince, userImage, userInitials, userName, userEmail } =
    useApp();
  const guest = useGuestAddress();
  const { ready, currentAddress, setServerAddress } = useServiceAddress();
  const { requestAddressChange } = useCartAddressGuard();
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
    // Route the change through the cart guard: if there's an active delivery
    // cart the kitchen can't reach at the new address, it confirms first.
    const coords = { lat: a.lat, lng: a.lng };
    const label = a.streetAddress;

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
      await requestAddressChange(coords, label, () => {
        setServerAddress(normalized);
        setProvince(normalized.province);
        void fetch("/api/user/address", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...normalized, unit: null }),
        }).catch(() => {
          // Non-critical — address is already updated in local state
        });
        setShowAddress(false);
      });
    } else {
      await requestAddressChange(coords, label, () => {
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
        setShowAddress(false);
      });
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
  const isLanding = pathname === "/app";
  const showFulfillmentToggle =
    pathname === "/app/browse" || pathname === "/app/search";
  const hideBottomNav = isOnboarding || isCheckout || isLanding;

  const bottomNavItems = isLoggedIn ? BOTTOM_NAV_LOGGED_IN : BOTTOM_NAV_GUEST;

  return (
    <div className={styles.shell}>
      {!isOnboarding && !isLanding && (
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

            <Suspense fallback={null}>
              <AppSearchInput variant="header" />
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
                          setShowAddressDropdown(false);
                          if (isLoggedIn || opt.active) return;
                          const target = guest.addresses.find(
                            (ad) => ad.id === opt.id,
                          );
                          if (!target) {
                            guest.selectAddress(opt.id);
                            return;
                          }
                          void requestAddressChange(
                            { lat: target.lat, lng: target.lng },
                            target.street.split(",")[0] || target.city,
                            () => guest.selectAddress(opt.id),
                          );
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
                  imageUrl={userImage}
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
        className={`${styles.main} ${isOnboarding ? styles.mainOnboarding : ""} ${isLanding ? styles.mainLanding : ""}`}
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
          {bottomNavItems.map((item) => {
            const { href, label, Icon } = item;
            const hrefPath = href.split("?")[0];
            const active =
              pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.bottomNavItem} ${active ? styles.bottomNavItemActive : ""}`}
              >
                <span className={styles.bottomNavIconWrap}>
                  <Icon size={22} strokeWidth={active ? 2.25 : 2} />
                </span>
                <span className={styles.bottomNavLabel}>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default function AppShell({
  children,
  isLoggedIn,
  isGuestAccount = false,
  userInitials = "",
  userName = "",
  userEmail = "",
  userImage = null,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  isGuestAccount?: boolean;
  userInitials?: string;
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
}) {
  return (
    <AppProvider
      isLoggedIn={isLoggedIn}
      isGuestAccount={isGuestAccount}
      userName={userName}
      userEmail={userEmail}
      userInitials={userInitials}
      userImage={userImage}
    >
      <CartProvider>
        <GuestAddressProvider>
          <ServiceAddressProvider isLoggedIn={isLoggedIn}>
            <CartAddressGuardProvider>
              <ShellInner isLoggedIn={isLoggedIn}>{children}</ShellInner>
            </CartAddressGuardProvider>
          </ServiceAddressProvider>
        </GuestAddressProvider>
      </CartProvider>
    </AppProvider>
  );
}
