import Image from "next/image";
import Link from "next/link";
import s from "./Header.module.css";

export default function Header() {
  return (
    <header className={s.header}>
      <div className={s.inner}>
        <Link href="/waitlist" className={s.logo} aria-label="7eats home">
          <Image
            src="/7eats-logo.svg"
            alt="7eats"
            width={88}
            height={28}
            priority
          />
        </Link>
        <nav className={s.nav} aria-label="Main navigation">
          <Link href="/founders" className={s.navLink}>
            About
          </Link>
          <Link href="#waitlist" className={s.applyBtn}>
            Apply
          </Link>
        </nav>
      </div>
    </header>
  );
}
