import Image from "next/image";
import Link from "next/link";
import s from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <div className={s.top}>
          <div className={s.brand}>
            <Image
              src="/7eats-logo.svg"
              alt="7eats"
              width={80}
              height={26}
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <p className={s.tagline}>
              The meal prep marketplace for home cooks in Toronto.
            </p>
          </div>
          <nav className={s.nav} aria-label="Footer navigation">
            <Link href="/waitlist" className={s.navLink}>
              Home
            </Link>
            <Link href="/founders" className={s.navLink}>
              About
            </Link>
            <Link href="#waitlist" className={s.navLink}>
              Apply
            </Link>
            <Link href="#faq" className={s.navLink}>
              FAQ
            </Link>
          </nav>
        </div>
        <div className={s.bottom}>
          <span className={s.copyright}>
            © {new Date().getFullYear()} 7eats Inc. All rights reserved.
          </span>
          <div className={s.legal}>
            <Link href="/privacy" className={s.legalLink}>
              Privacy Policy
            </Link>
            <Link href="/cookies" className={s.legalLink}>
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
