import { and, asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import OnboardingWizard from "@/app/components/OnboardingWizard";
import { db } from "@/db";
import {
  cookCertifications,
  cookPickupWindows,
  cookProfiles,
  cookProfileTags,
  tags,
} from "@/db/schema";
import { auth } from "@/lib/auth";

function formatCertExpiry(value: Date | null | undefined): string {
  if (!value) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function certFileLabel(fileUrl: string | null | undefined): string | undefined {
  if (!fileUrl) return undefined;
  const segment = fileUrl.split("/").pop();
  if (!segment) return "Uploaded certificate";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/business-auth/login");
  if (session.user.role === "client") redirect("/business-auth/login");

  const [profile] = await db
    .select({
      id: cookProfiles.id,
      displayName: cookProfiles.displayName,
      bio: cookProfiles.bio,
      photoUrl: cookProfiles.photoUrl,
      bannerUrl: cookProfiles.bannerUrl,
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
      offersPickup: cookProfiles.offersPickup,
      delivery: cookProfiles.delivery,
      acceptsSpecialRequests: cookProfiles.acceptsSpecialRequests,
      cancellationAllowed: cookProfiles.cancellationAllowed,
      stripeAccountId: cookProfiles.stripeAccountId,
      tosAcceptedAt: cookProfiles.tosAcceptedAt,
      currentSetupStep: cookProfiles.currentSetupStep,
      platformFeePct: cookProfiles.platformFeePct,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  const [tagSlugs, windows, cert, tagRows] = await Promise.all([
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
            windowType: cookPickupWindows.windowType,
            dayOfWeek: cookPickupWindows.dayOfWeek,
            fromTime: cookPickupWindows.fromTime,
            toTime: cookPickupWindows.toTime,
          })
          .from(cookPickupWindows)
          .where(eq(cookPickupWindows.cookId, profile.id))
      : Promise.resolve([]),
    profile
      ? db
          .select({
            certificateNumber: cookCertifications.certificateNumber,
            holderName: cookCertifications.holderName,
            expiresAt: cookCertifications.expiresAt,
            fileUrl: cookCertifications.fileUrl,
          })
          .from(cookCertifications)
          .where(
            and(
              eq(cookCertifications.cookId, profile.id),
              eq(cookCertifications.status, "pending_review"),
            ),
          )
          .orderBy(desc(cookCertifications.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({
        slug: tags.slug,
        label: tags.label,
        category: tags.category,
      })
      .from(tags)
      .orderBy(asc(tags.category), asc(tags.label)),
  ]);

  const tagOptions = {
    cuisines: tagRows
      .filter((t) => t.category === "cuisine")
      .map((t) => ({ slug: t.slug, label: t.label })),
    niches: tagRows
      .filter((t) => t.category === "niche")
      .map((t) => ({ slug: t.slug, label: t.label })),
    dietary: tagRows
      .filter((t) => t.category === "dietary")
      .map((t) => ({ slug: t.slug, label: t.label })),
  };

  return (
    <Suspense>
      <OnboardingWizard
        initialData={
          profile
            ? {
                displayName: profile.displayName,
                bio: profile.bio ?? "",
                photoUrl: profile.photoUrl ?? null,
                bannerUrl: profile.bannerUrl ?? null,
                socialLink: profile.socialLink ?? "",
                pickupStreet: profile.pickupStreet ?? "",
                pickupUnit: profile.pickupUnit ?? "",
                pickupCity: profile.pickupCity ?? "",
                pickupProvince: profile.pickupProvince ?? "",
                pickupPostal: profile.pickupPostal ?? "",
                pickupLat: profile.pickupLat ?? null,
                pickupLng: profile.pickupLng ?? null,
                pickupPlaceId: profile.pickupPlaceId ?? "",
                pickupWindows: windows
                  .filter((w) => w.windowType === "pickup")
                  .map((w) => ({
                    day: w.dayOfWeek,
                    from: w.fromTime.slice(0, 5),
                    to: w.toTime.slice(0, 5),
                  })),
                deliveryWindows: windows
                  .filter((w) => w.windowType === "delivery")
                  .map((w) => ({
                    day: w.dayOfWeek,
                    from: w.fromTime.slice(0, 5),
                    to: w.toTime.slice(0, 5),
                  })),
                leadTime: profile.leadTime ?? "",
                delivery: profile.delivery ?? "none",
                offersPickup: profile.offersPickup,
                acceptsSpecialRequests: profile.acceptsSpecialRequests,
                cancellationAllowed: profile.cancellationAllowed,
                selectedTagSlugs: tagSlugs,
                tagOptions,
                currentSetupStep: profile.currentSetupStep,
                platformFeePct: profile.platformFeePct,
                stripeConnected: false,
                certIdNumber: cert?.certificateNumber ?? "",
                certFullName: cert?.holderName ?? "",
                certExpiry: formatCertExpiry(cert?.expiresAt ?? null),
                certPhotoFileName: certFileLabel(cert?.fileUrl),
                tosAccepted: !!profile.tosAcceptedAt,
              }
            : undefined
        }
      />
    </Suspense>
  );
}
