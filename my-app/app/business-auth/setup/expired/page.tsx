import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function ExpiredPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/business/home" className={styles.logoLink}>
          <Image
            src="/7eats-logo.svg"
            alt="7eats"
            width={80}
            height={22}
            style={{ width: "auto" }}
            priority
          />
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.inner}>
          <div className={styles.iconWrap}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <h1 className={styles.title}>This link has expired.</h1>

          <p className={styles.body}>
            Setup links are valid for 3 days after they're sent. Yours has
            either expired, already been used, or the URL is not valid.
          </p>

          <div className={styles.card}>
            <p className={styles.cardLabel}>Need a new link?</p>
            <p className={styles.cardBody}>
              Email us and we'll send a fresh one.
            </p>
            <a href="mailto:team@7eats.ca" className={styles.emailLink}>
              team@7eats.ca
            </a>
          </div>

          <Link href="/business/home" className={styles.backLink}>
            ← Back to 7eats
          </Link>
        </div>
      </main>
    </div>
  );
}
