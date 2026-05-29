import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import LogoutButton from "./logout-button";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/business-auth/login");

  const [profile] = await db
    .select({
      currentSetupStep: cookProfiles.currentSetupStep,
      setupComplete: cookProfiles.setupComplete,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  const setupComplete = profile?.setupComplete ?? false;
  const currentStep = profile?.currentSetupStep ?? 3;

  const pendingSteps = setupComplete
    ? []
    : [
        ...(currentStep <= 3
          ? [{ label: "Compliance certificate", step: 3 }]
          : []),
        ...(currentStep >= 4
          ? [{ label: "Payment setup & terms", step: 4 }]
          : []),
      ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>7eats</span>
        <LogoutButton />
      </header>
      <main className={styles.main}>
        {pendingSteps.length > 0 && (
          <div className={styles.setupPrompt}>
            <div className={styles.promptHead}>
              <span className={styles.promptTitle}>
                Finish setting up your account
              </span>
              <span className={styles.promptSub}>
                Complete the remaining steps to go live on 7eats.
              </span>
            </div>
            <ul className={styles.promptSteps}>
              {pendingSteps.map((s) => (
                <li key={s.step} className={styles.promptStep}>
                  <span className={styles.promptDot} />
                  <span className={styles.promptStepLabel}>{s.label}</span>
                  <Link
                    href={`/business-auth/setup/onboarding?step=${s.step}`}
                    className={styles.promptLink}
                  >
                    Complete →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className={styles.placeholder}>Dashboard coming soon.</p>
      </main>
    </div>
  );
}
