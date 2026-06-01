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
  { href: "/app/browse", label: "Browse", Icon: LayoutGrid },
  { href: "/app/orders", label: "Orders", Icon: Package },
  { href: "/app/inbox", label: "Inbox", Icon: MessageSquare },
  { href: "/app/settings", label: "Account", Icon: User },
];

const TOP_NAV_LINKS = [
  { href: "/app/browse", label: "Browse" },
  { href: "/app/saved", label: "Saved" },
  { href: "/app/orders", label: "Orders" },
  { href: "/app/inbox", label: "Inbox" },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { itemCount } = useCart();

  const isOnboarding = pathname.startsWith("/app-auth/onboarding");
  const isCheckout = pathname.startsWith("/app/checkout");
  const hideBottomNav = isOnboarding || isCheckout;

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

              <Link
                href="/app/settings"
                className={styles.avatarBtn}
                aria-label="Account"
              >
                JD
              </Link>
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
          {BOTTOM_NAV.map(({ href, label, Icon }) => {
            const isCart = href === "/app/cart";
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.bottomNavItem} ${active ? styles.bottomNavItemActive : ""}`}
              >
                <span className={styles.bottomNavIconWrap}>
                  <Icon size={22} />
                  {isCart && itemCount > 0 && (
                    <span className={styles.bottomNavBadge}>{itemCount}</span>
                  )}
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ShellInner>{children}</ShellInner>
    </CartProvider>
  );
}
