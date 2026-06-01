"use client";

import {
  LayoutGrid,
  MessageSquare,
  Package,
  ShoppingBag,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartProvider, useCart } from "./_cart-context";
import styles from "./_shell.module.css";

const BOTTOM_NAV = [
  {
    href: "/app/browse",
    label: "Browse",
    Icon: LayoutGrid,
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

const TOP_NAV_LINKS = [
  { href: "/app/browse", label: "Browse" },
  { href: "/app/saved", label: "Saved" },
  { href: "/app/orders", label: "Orders" },
  { href: "/app/inbox", label: "Inbox" },
];

function ShellInner({
  children,
  isLoggedIn,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const { itemCount } = useCart();

  const isOnboarding = pathname.startsWith("/app-auth/onboarding");
  const isCheckout = pathname.startsWith("/app/checkout");
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
                width={68}
                height={38}
                priority
              />
            </Link>

            {isLoggedIn && (
              <nav className={styles.desktopNav} aria-label="Main navigation">
                {TOP_NAV_LINKS.map(({ href, label }) => {
                  const active =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            )}

            <div className={styles.headerRight}>
              <Link
                href="/app/cart"
                className={styles.cartBtn}
                aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
              >
                <ShoppingBag size={20} />
                {itemCount > 0 && (
                  <span className={styles.cartBadge}>{itemCount}</span>
                )}
              </Link>

              {isLoggedIn ? (
                <Link
                  href="/app/settings"
                  className={styles.avatarBtn}
                  aria-label="Account"
                >
                  JD
                </Link>
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
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
}) {
  return (
    <CartProvider>
      <ShellInner isLoggedIn={isLoggedIn}>{children}</ShellInner>
    </CartProvider>
  );
}
