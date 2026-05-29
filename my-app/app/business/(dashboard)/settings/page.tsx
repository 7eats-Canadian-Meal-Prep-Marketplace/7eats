import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <Link href="/business/dashboard" className={styles.back}>
        <ArrowLeft size={16} />
        Dashboard
      </Link>
      <h1 className={styles.title}>Settings</h1>
    </div>
  );
}
