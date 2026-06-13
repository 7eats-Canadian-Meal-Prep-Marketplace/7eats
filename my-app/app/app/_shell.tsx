"use client";

import {
  Check,
  ChevronDown,
  Heart,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Plus,
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
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import type { NormalizedAddress } from "@/lib/types/address";
import { AppProvider, useApp } from "./_app-context";
import { CartProvider, useCart } from "./_cart-context";
import styles from "./_shell.module.css";

function HeaderSearchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [val, setVal] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setVal(searchParams.get("q") ?? "");
  }, [searchParams]);

  return (
    <form
      className={styles.headerSearch}
      onSubmit={(e) => {
        e.preventDefault();
        const q = val.trim();
        router.push(
          q ? `/app/search?q=${encodeURIComponent(q)}` : "/app/search",
        );
      }}
    >
      <Search size={16} className={styles.headerSearchIcon} />
      <input
        className={styles.headerSearchInput}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Search cooks, dishes, cuisines…"
      />
    </form>
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
  current,
  onConfirm,
  onClose,
}: {
  current: NormalizedAddress | null;
  onConfirm: (a: NormalizedAddress) => void;
  onClose: () => void;
}) {
  const [resolved, setResolved] = useState<NormalizedAddress | null>(current);

  const initialValue = current
    ? [
        current.street,
        current.unit,
        current.city,
        current.province,
        current.postal,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismiss
    <div className={styles.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={styles.addrModal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={styles.addrModalHead}>
          <span className={styles.addrModalTitle}>Change address</span>
          <button
            type="button"
            className={styles.addrModalClose}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className={styles.addrModalBody}>
          <AddressAutocomplete
            onResolve={setResolved}
            initialValue={initialValue}
            placeholder="Enter your address…"
            inputClassName={styles.addrInput}
          />
        </div>
        <div className={styles.addrModalFoot}>
          <button
            type="button"
            className={styles.addrConfirmBtn}
            disabled={!resolved}
            onClick={() => {
              if (resolved) {
                onConfirm(resolved);
                onClose();
              }
            }}
          >
            Confirm address
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
  { href: "/app/inbox", label: "Inbox", Icon: MessageSquare },
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
  {
    href: "/app/inbox",
    label: "Inbox",
    Icon: MessageSquare,
    requiresAuth: true,
  },
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
  const { listingCount } = useCart();
  const { setProvince } = useApp();
  const [address, setAddress] = useState<NormalizedAddress | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const addressDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch saved address on mount (only when logged in)
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/user/address")
      .then((res) => res.json())
      .then((data) => {
        if (data.address) {
          const normalized = data.address as NormalizedAddress;
          setAddress(normalized);
          setProvince(normalized.province);
        }
      })
      .catch(() => {
        // Non-critical — silently ignore fetch errors
      });
  }, [isLoggedIn, setProvince]);

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
                  {address ? address.street.split(",")[0] : "Add address"}
                </span>
                <ChevronDown size={12} className={styles.addressChevron} />
              </button>

              {showAddressDropdown && (
                <div className={styles.addressDropdown}>
                  {address && (
                    <button
                      key={address.placeId}
                      type="button"
                      className={`${styles.addressOption} ${styles.addressOptionActive}`}
                      onClick={() => {
                        setShowAddressDropdown(false);
                      }}
                    >
                      <MapPin size={13} className={styles.addressOptionIcon} />
                      <span>{address.street.split(",")[0]}</span>
                      <Check size={13} className={styles.addressOptionCheck} />
                    </button>
                  )}
                  <div className={styles.addressDropdownDivider} />
                  <button
                    type="button"
                    className={`${styles.addressOption} ${styles.addressOptionAdd}`}
                    onClick={() => {
                      setShowAddressDropdown(false);
                      setShowAddress(true);
                    }}
                  >
                    <Plus size={13} className={styles.addressOptionIcon} />
                    <span>{address ? "Change address" : "Add address"}</span>
                  </button>
                </div>
              )}
            </div>

            <div className={styles.headerRight}>
              <Link
                href="/app/cart"
                className={styles.cartPill}
                aria-label={`Cart, ${listingCount} listing${listingCount === 1 ? "" : "s"}`}
              >
                <ShoppingCart size={18} strokeWidth={2} />
                <span className={styles.cartCount}>{listingCount}</span>
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

      {showAddress && (
        <AddressModal
          current={address}
          onConfirm={async (newAddress) => {
            setAddress(newAddress);
            setProvince(newAddress.province);
            try {
              await fetch("/api/user/address", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(newAddress),
              });
            } catch {
              // Non-critical — address is already updated in local state
            }
          }}
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
    <AppProvider isLoggedIn={isLoggedIn}>
      <CartProvider>
        <ShellInner
          isLoggedIn={isLoggedIn}
          userInitials={userInitials}
          userName={userName}
          userEmail={userEmail}
        >
          {children}
        </ShellInner>
      </CartProvider>
    </AppProvider>
  );
}
