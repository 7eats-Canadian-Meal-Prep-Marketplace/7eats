import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import OnboardingWizard from "@/app/components/OnboardingWizard";
import { db } from "@/db";
import {
  cookPickupWindows,
  cookProfiles,
  cookProfileTags,
  tags,
} from "@/db/schema";
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
      pickupStreet: cookProfiles.pickupStreet,
      pickupUnit: cookProfiles.pickupUnit,
      pickupCity: cookProfiles.pickupCity,
      pickupProvince: cookProfiles.pickupProvince,
      pickupPostal: cookProfiles.pickupPostal,
      pickupLat: cookProfiles.pickupLat,
      pickupLng: cookProfiles.pickupLng,
      pickupPlaceId: cookProfiles.pickupPlaceId,
      leadTime: cookProfiles.leadTime,
      maxCapacity: cookProfiles.maxCapacity,
      delivery: cookProfiles.delivery,
      acceptsSpecialRequests: cookProfiles.acceptsSpecialRequests,
      stripeAccountId: cookProfiles.stripeAccountId,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  const [tagSlugs, windows] = await Promise.all([
    profile
      ? db
          .select({ slug: tags.slug })
          .from(cookProfileTags)
          .innerJoin(tags, eq(cookProfileTags.tagId, tags.id))
          .where(eq(cookProfileTags.cookProfileId, profile.id))
          .then((rows) => rows.map((r) => r.slug))
      : Promise.resolve([]),
    profile
      ? db
          .select({
            dayOfWeek: cookPickupWindows.dayOfWeek,
            fromTime: cookPickupWindows.fromTime,
            toTime: cookPickupWindows.toTime,
          })
          .from(cookPickupWindows)
          .where(eq(cookPickupWindows.cookId, profile.id))
      : Promise.resolve([]),
  ]);

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
                pickupStreet: profile.pickupStreet ?? "",
                pickupUnit: profile.pickupUnit ?? "",
                pickupCity: profile.pickupCity ?? "",
                pickupProvince: profile.pickupProvince ?? "",
                pickupPostal: profile.pickupPostal ?? "",
                pickupLat: profile.pickupLat ?? null,
                pickupLng: profile.pickupLng ?? null,
                pickupPlaceId: profile.pickupPlaceId ?? "",
                pickupWindows: windows.map((w) => ({
                  day: w.dayOfWeek,
                  from: w.fromTime.slice(0, 5),
                  to: w.toTime.slice(0, 5),
                })),
                leadTime: profile.leadTime ?? "",
                maxCapacity: profile.maxCapacity?.toString() ?? "",
                delivery: profile.delivery ?? "none",
                acceptsSpecialRequests: profile.acceptsSpecialRequests,
                selectedTagSlugs: tagSlugs,
                stripeConnected: !!profile.stripeAccountId,
              }
            : undefined
        }
      />
    </Suspense>
  );
}
