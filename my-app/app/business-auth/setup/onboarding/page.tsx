import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import OnboardingWizard from "@/app/components/OnboardingWizard";
import { db } from "@/db";
import { cookProfiles, cookProfileTags, tags } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/business-auth/login");

  const [profile] = await db
    .select({
      id: cookProfiles.id,
      displayName: cookProfiles.displayName,
      bio: cookProfiles.bio,
      photoUrl: cookProfiles.photoUrl,
      socialLink: cookProfiles.socialLink,
      pickupAddress: cookProfiles.pickupAddress,
      pickupDays: cookProfiles.pickupDays,
      pickupFrom: cookProfiles.pickupFrom,
      pickupTo: cookProfiles.pickupTo,
      leadTime: cookProfiles.leadTime,
      maxCapacity: cookProfiles.maxCapacity,
      delivery: cookProfiles.delivery,
      acceptsSpecialRequests: cookProfiles.acceptsSpecialRequests,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  const tagSlugs = profile
    ? await db
        .select({ slug: tags.slug })
        .from(cookProfileTags)
        .innerJoin(tags, eq(cookProfileTags.tagId, tags.id))
        .where(eq(cookProfileTags.cookProfileId, profile.id))
        .then((rows) => rows.map((r) => r.slug))
    : [];

  return (
    <Suspense>
      <OnboardingWizard
        initialData={
          profile
            ? {
                displayName: profile.displayName,
                bio: profile.bio ?? "",
                photoUrl: profile.photoUrl ?? null,
                socialLink: profile.socialLink ?? "",
                pickupAddress: profile.pickupAddress ?? "",
                pickupDays: profile.pickupDays ?? [],
                pickupFrom: profile.pickupFrom ?? "",
                pickupTo: profile.pickupTo ?? "",
                leadTime: profile.leadTime ?? "",
                maxCapacity: profile.maxCapacity?.toString() ?? "",
                delivery: profile.delivery ?? "none",
                acceptsSpecialRequests: profile.acceptsSpecialRequests,
                selectedTagSlugs: tagSlugs,
              }
            : undefined
        }
      />
    </Suspense>
  );
}
