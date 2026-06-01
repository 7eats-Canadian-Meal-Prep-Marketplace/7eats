import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import AppShell from "./_shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isLoggedIn = false;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    isLoggedIn = session?.user?.role === "client";
  } catch {
    // unauthenticated — browse is public, keep going
  }

  return <AppShell isLoggedIn={isLoggedIn}>{children}</AppShell>;
}
