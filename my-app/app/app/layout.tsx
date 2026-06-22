import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { auth } from "@/lib/auth";
import { profileDisplayName, profileInitials } from "@/lib/user-display";
import AppShell from "./_shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isLoggedIn = false;
  let userInitials = "";
  let userName = "";
  let userEmail = "";
  let userImage: string | null = null;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.role === "client") {
      isLoggedIn = true;
      userEmail = session.user.email;

      const [row] = await db
        .select({
          image: authUser.image,
          name: authUser.name,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
        })
        .from(authUser)
        .where(eq(authUser.id, session.user.id))
        .limit(1);

      const first = row?.firstName ?? undefined;
      const last = row?.lastName ?? undefined;
      const accountName = row?.name ?? session.user.name;
      userName = profileDisplayName(first, last, accountName, userEmail);
      userInitials = profileInitials(first, last, accountName, userEmail);
      userImage = row?.image ?? null;
    }
  } catch {
    // unauthenticated — browse is public, keep going
  }

  return (
    <AppShell
      isLoggedIn={isLoggedIn}
      userInitials={userInitials}
      userName={userName}
      userEmail={userEmail}
      userImage={userImage}
    >
      {children}
    </AppShell>
  );
}
