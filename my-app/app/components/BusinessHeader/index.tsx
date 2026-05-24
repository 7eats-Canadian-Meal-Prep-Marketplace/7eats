import Image from "next/image";
import Link from "next/link";
import styles from "./BusinessHeader.module.css";

export default function BusinessHeader() {
  return (
    <header className={`header ${styles.header}`}>
      <div className={`wrap header-inner ${styles.inner}`}>
        <Link href="/business/home" className="brand">
          <Image
            src="/7eats-logo.svg"
            alt="7eats"
            width={150}
            height={40}
            style={{ width: "auto" }}
            priority
          />
        </Link>
      </div>
    </header>
  );
}
