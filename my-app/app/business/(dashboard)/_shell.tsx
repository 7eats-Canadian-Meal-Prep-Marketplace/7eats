"use client";

import {
  Bell,
  Calendar,
  ClipboardList,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Menu,
  Store,
  TrendingUp,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./_shell.module.css";

const NAV_ITEMS = [
  { href: "/business/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/business/orders", label: "Orders", Icon: ClipboardList },
  { href: "/business/listings", label: "Listings", Icon: Store },
  { href: "/business/earnings", label: "Earnings", Icon: TrendingUp },
  { href: "/business/calendar", label: "Calendar", Icon: Calendar },
  { href: "/business/inbox", label: "Inbox", Icon: Inbox },
];

interface PendingStep {
  label: string;
  step: number;
}

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  pendingSteps: PendingStep[];
  children: React.ReactNode;
}

export default function DashboardShell({
  firstName,
  lastName,
  email,
  pendingSteps,
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname.startsWith("/business/settings");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Account";

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value used inside
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const res = await fetch("/api/auth/sign-out", { method: "POST" });
    const data = await res.json();
    router.push(data.redirect ?? "/business-auth/login");
  };

  return (
    <div className={styles.shell}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            {!isSettings && (
              <button
                type="button"
                className={styles.hamburger}
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label="Toggle navigation"
              >
                {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <Link href="/business/dashboard" className={styles.brand}>
              <Image
                src="/7eats-logo.svg"
                alt="7eats"
                width={72}
                height={41}
                priority
              />
            </Link>
          </div>

          <div className={styles.headerRight}>
            <button type="button" className={styles.iconBtn} aria-label="Help">
              <HelpCircle size={20} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>
            <Link
              href="/business/inbox"
              className={styles.iconBtn}
              aria-label="Inbox"
            >
              <Inbox size={20} />
            </Link>

            <div className={styles.profileWrap} ref={profileRef}>
              <button
                type="button"
                className={styles.avatar}
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                {initials}
              </button>
              {profileOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownMeta}>
                    <span className={styles.dropdownName}>{displayName}</span>
                    <span className={styles.dropdownEmail}>{email}</span>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <Link
                    href="/business/settings"
                    className={styles.dropdownItem}
                    onClick={() => setProfileOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    className={`${styles.dropdownItem} ${styles.dropdownSignOut}`}
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? "Signing out..." : "Log out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className={styles.body}>
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className={styles.overlay}
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* Left panel — hidden on settings */}
        {!isSettings && (
          <nav
            className={`${styles.nav} ${mobileNavOpen ? styles.navOpen : ""}`}
            aria-label="Main navigation"
          >
            <ul className={styles.navList}>
              {NAV_ITEMS.map(({ href, label, Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                    >
                      <Icon size={17} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {/* Main frame */}
        <main className={styles.main}>
          {pendingSteps.length > 0 && (
            <div className={styles.banner}>
              <div className={styles.bannerHead}>
                <span className={styles.bannerTitle}>
                  Finish setting up your account
                </span>
                <span className={styles.bannerSub}>
                  Complete the remaining steps to go live on 7eats.
                </span>
              </div>
              <ul className={styles.bannerSteps}>
                {pendingSteps.map((s) => (
                  <li key={s.step} className={styles.bannerStep}>
                    <span className={styles.bannerDot} />
                    <span className={styles.bannerStepLabel}>{s.label}</span>
                    <Link
                      href={`/business-auth/setup/onboarding?step=${s.step}`}
                      className={styles.bannerLink}
                    >
                      Complete
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
