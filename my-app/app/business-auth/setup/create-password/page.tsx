import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import CreatePasswordForm from "@/app/components/CreatePasswordForm";
import SetupSidebar from "@/app/components/SetupSidebar";
import { db } from "@/db";
import { setupTokens } from "@/db/schema";
import styles from "./page.module.css";

export default async function CreatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/business-auth/setup/expired");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [tokenRow] = await db
    .select()
    .from(setupTokens)
    .where(
      and(
        eq(setupTokens.tokenHash, tokenHash),
        isNull(setupTokens.consumedAt),
        gt(setupTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    redirect("/business-auth/setup/expired");
  }

  return (
    <div className={styles.page}>
      <SetupSidebar activeStep={1} />
      <main className={styles.right}>
        <div className={styles.rightInner}>
          <CreatePasswordForm token={token} />
        </div>
      </main>
    </div>
  );
}
