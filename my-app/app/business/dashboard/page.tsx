import LogoutButton from "./logout-button";
import styles from "./page.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>7eats</span>
        <LogoutButton />
      </header>
      <main className={styles.main}>
        <p className={styles.placeholder}>Dashboard coming soon.</p>
      </main>
    </div>
  );
}
