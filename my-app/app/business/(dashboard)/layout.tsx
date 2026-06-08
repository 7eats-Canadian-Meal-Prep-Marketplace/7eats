import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { authUser, cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import DashboardShell from "./_shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/business-auth/login");

  const [row] = await db
    .select({
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      email: authUser.email,
      currentSetupStep: cookProfiles.currentSetupStep,
      setupComplete: cookProfiles.setupComplete,
    })
    .from(cookProfiles)
    .innerJoin(authUser, eq(authUser.id, cookProfiles.userId))
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  const setupComplete = row?.setupComplete ?? false;
  const currentStep = row?.currentSetupStep ?? 3;

  const pendingSteps = setupComplete
    ? []
    : [
        ...(currentStep <= 3
          ? [{ label: "Compliance certificate", step: 3 }]
          : []),
        { label: "Payment setup & terms", step: 4 },
      ];

  return (
    <DashboardShell
      firstName={row?.firstName ?? ""}
      lastName={row?.lastName ?? ""}
      email={row?.email ?? session.user.email}
      pendingSteps={pendingSteps}
    >
      {children}
    </DashboardShell>
  );
}
