import { headers } from "next/headers";
import { auth } from "@/lib/auth";
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

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.role === "client") {
      isLoggedIn = true;
      const first = (session.user as Record<string, unknown>).firstName as
        | string
        | undefined;
      const last = (session.user as Record<string, unknown>).lastName as
        | string
        | undefined;
      userName =
        [first, last].filter(Boolean).join(" ") || session.user.name || "";
      userInitials =
        `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
      userEmail = session.user.email;
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
    >
      {children}
    </AppShell>
  );
}
