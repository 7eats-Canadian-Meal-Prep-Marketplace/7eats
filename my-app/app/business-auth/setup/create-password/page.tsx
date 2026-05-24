import { redirect } from "next/navigation";
import CreatePasswordForm from "@/app/components/CreatePasswordForm";
import SetupSidebar from "@/app/components/SetupSidebar";
import styles from "./page.module.css";

// TODO: Replace with real DB lookup — validate token exists, not expired, not used
const MOCK_VALID_TOKEN = "dev";

export default async function CreatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token || token !== MOCK_VALID_TOKEN) {
    redirect("/business-auth/setup/expired");
  }

  return (
    <div className={styles.page}>
      <SetupSidebar activeStep={1} />
      <main className={styles.right}>
        <div className={styles.rightInner}>
          <CreatePasswordForm />
        </div>
      </main>
    </div>
  );
}
