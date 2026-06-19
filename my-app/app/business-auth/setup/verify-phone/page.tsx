import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SetupSidebar from "@/app/components/SetupSidebar";
import VerifyPhoneForm from "@/app/components/VerifyPhoneForm";
import { db } from "@/db";
import { cookApplications, cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import styles from "./page.module.css";

export default async function VerifyPhonePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/business-auth/login");
  if (session.user.role === "client") redirect("/business-auth/login");

  const [row] = await db
    .select({ contactPhone: cookApplications.contactPhone })
    .from(cookProfiles)
    .innerJoin(
      cookApplications,
      eq(cookProfiles.applicationId, cookApplications.id),
    )
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  const defaultPhone = row?.contactPhone ?? "";

  return (
    <div className={styles.page}>
      <SetupSidebar activeStep={2} completedSteps={[1]} />
      <main className={styles.right}>
        <div className={styles.rightInner}>
          <Suspense>
            <VerifyPhoneForm defaultPhone={defaultPhone} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
