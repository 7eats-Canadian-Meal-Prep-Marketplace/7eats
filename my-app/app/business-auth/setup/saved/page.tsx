import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function SavedPage() {
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
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </div>

          <h1 className={styles.title}>Progress saved.</h1>

          <p className={styles.body}>
            We've saved where you left off. Come back whenever you're ready.
            Your setup link is valid for{" "}
            <strong>7 days from when it was sent.</strong>
          </p>

          <div className={styles.card}>
            <p className={styles.cardLabel}>To continue setup</p>
            <p className={styles.cardBody}>
              Open the email we sent you and click the link again. You'll land
              right back at the step you left.
            </p>
            {/* TODO: Show the cook's actual email address from their session */}
            <p className={styles.cardEmail}>Check the email on file</p>
          </div>

          <div className={styles.tips}>
            <p className={styles.tipsLabel}>Have these ready when you return</p>
            <ul className={styles.tipsList}>
              <li>A photo of yourself or your kitchen (min 400×400)</li>
              <li>Your food handler certificate (PDF or JPEG)</li>
              <li>Your pickup address</li>
              <li>Your bank account details for Stripe Connect</li>
            </ul>
          </div>

          <Link href="/business/home" className={styles.backLink}>
            ← Back to 7eats
          </Link>
        </div>
      </main>
    </div>
  );
}
