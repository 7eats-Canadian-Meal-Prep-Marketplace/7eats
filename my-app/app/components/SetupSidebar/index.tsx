import Image from "next/image";
import Link from "next/link";
import styles from "./SetupSidebar.module.css";

const STEPS = [
  { num: 1, label: "Create password" },
  { num: 2, label: "Verify phone" },
  { num: 3, label: "Cook profile" },
  { num: 4, label: "Operations" },
  { num: 5, label: "Compliance" },
  { num: 6, label: "Legal & payments" },
];

type Props = {
  activeStep: number;
  completedSteps?: number[];
};

export default function SetupSidebar({
  activeStep,
  completedSteps = [],
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <Link href="/business/home" className={styles.logo}>
            <Image
              src="/7eats-logo.svg"
              alt="7eats"
              width={96}
              height={26}
              style={{ width: "auto", filter: "brightness(0) invert(1)" }}
              priority
            />
          </Link>
        </div>

        <div className={styles.body}>
          <span className={styles.eyebrow}>Kitchen setup</span>
          <div className={styles.stepsList}>
            {STEPS.map(({ num, label }) => {
              const isActive = num === activeStep;
              const isDone = completedSteps.includes(num);
              return (
                <div key={num} className={styles.stepRow}>
                  <div
                    className={`${styles.stepBullet} ${isActive ? styles.stepBulletActive : ""} ${isDone && !isActive ? styles.stepBulletDone : ""}`}
                  >
                    {isDone && !isActive ? "✓" : num}
                  </div>
                  <div className={styles.stepText}>
                    <span className={styles.stepSubLabel}>Step {num} of 6</span>
                    <span
                      className={`${styles.stepName} ${isActive ? styles.stepNameActive : ""} ${isDone && !isActive ? styles.stepNameDone : ""}`}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
