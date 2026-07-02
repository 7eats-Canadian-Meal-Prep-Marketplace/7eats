"use client";

import {
  Bell,
  Calendar,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Menu,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Notification } from "@/app/api/business/dashboard/notifications/_lib";
import { HostProvider } from "./_host-context";
import styles from "./_shell.module.css";

function formatNotifTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
  return `${Math.round(diffMin / 1440)}d`;
}

// Detail strings come through as "Customer Name · Dish Name"; split them so the
// customer reads crisp and the dish reads as softer secondary text.
function splitNotifDetail(detail: string): { who: string; what: string } {
  const idx = detail.indexOf("·");
  if (idx === -1) return { who: detail.trim(), what: "" };
  return {
    who: detail.slice(0, idx).trim(),
    what: detail.slice(idx + 1).trim(),
  };
}

const NAV_ITEMS = [
  { href: "/business/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/business/orders", label: "Orders", Icon: ClipboardList },
  { href: "/business/listings", label: "Meals", Icon: Store },
  { href: "/business/earnings", label: "Earnings", Icon: TrendingUp },
  { href: "/business/calendar", label: "Calendar", Icon: Calendar },
];

interface PendingStep {
  label: string;
  step: number;
}

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string | null;
  pendingSteps: PendingStep[];
  children: React.ReactNode;
}

export default function DashboardShell({
  firstName,
  lastName,
  email,
  photoUrl,
  pendingSteps,
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname.startsWith("/business/settings");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Account";

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    fetch("/api/business/dashboard/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setNotifications(data.data);
      })
      .catch(() => {});
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value used inside
  useEffect(() => {
    setMobileNavOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  const handleNotifClick = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setNotifOpen(false);
    fetch("/api/business/dashboard/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  };

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
            <a
              className={styles.iconBtn}
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Help (opens in a new tab)"
            >
              <HelpCircle size={20} />
            </a>
            <div className={styles.notifWrap} ref={notifRef}>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
              >
                <Bell size={20} />
                {unreadCount > 0 && <span className={styles.notifDot} />}
              </button>
              {notifOpen && (
                <div className={styles.notifPanel}>
                  <div className={styles.notifHead}>
                    <span className={styles.notifTitle}>Notifications</span>
                    {unreadCount > 0 && (
                      <span className={styles.notifCount}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className={styles.notifList}>
                    {notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.href}
                        className={`${styles.notifItem} ${n.isRead ? "" : styles.notifItemUnread}`}
                        onClick={() => handleNotifClick(n.id)}
                      >
                        <span
                          className={`${styles.notifIcon} ${n.kind === "review" ? styles.notifIconReview : n.kind === "cancelled" ? styles.notifIconCancelled : styles.notifIconOrder}`}
                        >
                          {n.kind === "review" ? (
                            <Star size={17} />
                          ) : n.kind === "cancelled" ? (
                            <X size={17} />
                          ) : (
                            <ShoppingBag size={17} />
                          )}
                        </span>
                        <span className={styles.notifBody}>
                          <span className={styles.notifItemTitle}>
                            {n.title}
                            {n.kind === "review" && n.rating != null && (
                              <span className={styles.notifRating}>
                                <span className={styles.notifBullet}>•</span>
                                {n.rating.toFixed(1)}
                                <Star size={11} className={styles.starFill} />
                              </span>
                            )}
                          </span>
                          <span className={styles.notifDetail}>
                            {(() => {
                              const { who, what } = splitNotifDetail(n.detail);
                              return (
                                <>
                                  <span className={styles.notifWho}>{who}</span>
                                  {what && (
                                    <>
                                      <span className={styles.notifDot2}>
                                        ·
                                      </span>
                                      <span className={styles.notifWhat}>
                                        {what}
                                      </span>
                                    </>
                                  )}
                                </>
                              );
                            })()}
                          </span>
                        </span>
                        <span className={styles.notifTime}>
                          {formatNotifTime(n.timestamp)}
                        </span>
                        {!n.isRead && (
                          <span className={styles.notifUnreadDot} />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.profileWrap} ref={profileRef}>
              <button
                type="button"
                className={styles.avatar}
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt=""
                    fill
                    sizes="34px"
                    className={styles.avatarImg}
                  />
                ) : (
                  initials
                )}
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
                <span className={styles.bannerNote}>
                  Until then, your kitchen and dishes stay hidden from
                  customers. You can keep adding them now and they’ll appear the
                  moment setup is complete.
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
          <HostProvider value={{ firstName, lastName }}>
            {children}
          </HostProvider>
        </main>
      </div>
    </div>
  );
}
