"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import CalendlyButton from "./CalendlyButton";

interface HeaderProps {
  activePage?: "home" | "team";
}

export default function Header({ activePage = "home" }: HeaderProps) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <>
      <header className="header">
        <div className="wrap header-inner">
          <Link href="/waitlist" className="brand">
            <Image
              className="brand-logo"
              src="/7eats-logo.svg"
              alt="7eats"
              width={120}
              height={32}
              style={{ width: "auto" }}
              priority
            />
          </Link>
          <nav className="nav-desktop">
            <Link
              href="/waitlist"
              className={activePage === "home" ? "is-active" : ""}
            >
              Home
            </Link>
            <Link
              href="/team"
              className={activePage === "team" ? "is-active" : ""}
            >
              Meet the team
            </Link>
          </nav>
          <div className="header-cta-group">
            <Link href="#cta" className="btn btn-primary btn-sm">
              Join the waitlist
            </Link>
            <button
              type="button"
              className="nav-toggle"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                <title>Menu</title>
                <path
                  d="M2 4h12M2 8h12M2 12h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <aside className={`nav-mobile${navOpen ? " is-open" : ""}`}>
        <div className="nav-mobile-top">
          <Link href="/waitlist" className="brand" onClick={closeNav}>
            <Image
              className="brand-logo"
              src="/7eats-logo.svg"
              alt="7eats"
              width={120}
              height={32}
              style={{ width: "auto" }}
            />
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Close navigation"
            onClick={closeNav}
          >
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
              <title>Close</title>
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="nav-mobile-links">
          <Link href="/waitlist" onClick={closeNav}>
            Home <span className="chev">&rarr;</span>
          </Link>
          <Link href="/team" onClick={closeNav}>
            Meet the team <span className="chev">&rarr;</span>
          </Link>
        </div>
        <div className="nav-mobile-cta">
          <Link href="#cta" className="btn btn-primary" onClick={closeNav}>
            Join the waitlist
          </Link>
          <CalendlyButton className="btn btn-ghost">
            Book a call
          </CalendlyButton>
        </div>
      </aside>
    </>
  );
}
