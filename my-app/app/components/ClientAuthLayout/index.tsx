import styles from "./ClientAuthLayout.module.css";

export function ClientAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell} data-auth-shell>
      <div className={styles.content}>{children}</div>
    </main>
  );
}
