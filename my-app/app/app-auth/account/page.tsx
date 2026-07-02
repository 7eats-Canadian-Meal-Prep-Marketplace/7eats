import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import styles from "./page.module.css";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your account - 7eats",
  description: "Your 7eats account.",
};

export default async function AccountPage() {
  // The page can't render without a valid session — middleware also guards this
  // route, but the page guards itself too so it never leaks data on a stale call.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/app-auth/login");

  const [profile] = await db
    .select({
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      email: authUser.email,
      phone: authUser.phone,
    })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  const fullName =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : (session.user.name ?? "");

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Signed in</p>
        <h1 className={styles.title}>
          {fullName ? `Welcome, ${fullName}.` : "Welcome."}
        </h1>

        <dl className={styles.details}>
          <div className={styles.detailRow}>
            <dt className={styles.dt}>Email</dt>
            <dd className={styles.dd}>
              {profile?.email ?? session.user.email}
            </dd>
          </div>
          {profile?.phone && (
            <div className={styles.detailRow}>
              <dt className={styles.dt}>Phone</dt>
              <dd className={styles.dd}>{profile.phone}</dd>
            </div>
          )}
        </dl>

        <SignOutButton />
      </div>
    </main>
  );
}
