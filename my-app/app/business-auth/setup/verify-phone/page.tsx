import { Suspense } from "react";
import SetupSidebar from "@/app/components/SetupSidebar";
import VerifyPhoneForm from "@/app/components/VerifyPhoneForm";
import styles from "./page.module.css";

// TODO: Protect this route — require a valid in-progress setup session

export default function VerifyPhonePage() {
  return (
    <div className={styles.page}>
      <SetupSidebar activeStep={2} completedSteps={[1]} />
      <main className={styles.right}>
        <div className={styles.rightInner}>
          <Suspense>
            <VerifyPhoneForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
