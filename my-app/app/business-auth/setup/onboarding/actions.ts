"use server";

import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cookProfiles, cookProfileTags, tags } from "@/db/schema";
import { auth } from "@/lib/auth";
import { uploadAvatar } from "@/lib/storage/avatars";

export async function saveStep1(
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated." };

  const displayName = ((formData.get("displayName") as string) ?? "").trim();
  const bio = ((formData.get("bio") as string) ?? "").trim();
  const socialLink =
    ((formData.get("socialLink") as string) ?? "").trim() || null;
  const cuisineSlugs = ((formData.get("cuisines") as string) ?? "")
    .split(",")
    .filter(Boolean);
  const nicheSlugs = ((formData.get("niches") as string) ?? "")
    .split(",")
    .filter(Boolean);
  const dietarySlugs = ((formData.get("dietary") as string) ?? "")
    .split(",")
    .filter(Boolean);
  const photo = formData.get("photo") as File | null;

  if (!displayName) return { error: "Display name is required." };
  if (bio.length < 100 || bio.length > 500)
    return { error: "Bio must be between 100 and 500 characters." };
  if (cuisineSlugs.length === 0)
    return { error: "Select at least one cuisine type." };

  let photoUrl: string | undefined;
  if (photo && photo.size > 0) {
    if (!["image/jpeg", "image/png"].includes(photo.type))
      return { error: "Photo must be JPEG or PNG." };
    if (photo.size > 5 * 1024 * 1024)
      return { error: "Photo must be smaller than 5 MB." };
    try {
      const buf = Buffer.from(await photo.arrayBuffer());
      photoUrl = await uploadAvatar(
        session.user.id,
        photo.name,
        buf,
        photo.type,
      );
    } catch {
      return { error: "Photo upload failed. Please try again." };
    }
  }

  const [profile] = await db
    .select({
      id: cookProfiles.id,
      currentSetupStep: cookProfiles.currentSetupStep,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);
  if (!profile) return { error: "Profile not found." };

  const allSlugs = [...cuisineSlugs, ...nicheSlugs, ...dietarySlugs];
  const resolvedTags =
    allSlugs.length > 0
      ? await db
          .select({ id: tags.id })
          .from(tags)
          .where(inArray(tags.slug, allSlugs))
      : [];

  await db.transaction(async (tx) => {
    await tx
      .update(cookProfiles)
      .set({
        displayName,
        bio,
        socialLink,
        ...(photoUrl !== undefined ? { photoUrl } : {}),
        currentSetupStep: Math.max(profile.currentSetupStep, 2),
      })
      .where(eq(cookProfiles.userId, session.user.id));

    await tx
      .delete(cookProfileTags)
      .where(eq(cookProfileTags.cookProfileId, profile.id));

    if (resolvedTags.length > 0) {
      await tx.insert(cookProfileTags).values(
        resolvedTags.map(({ id: tagId }) => ({
          cookProfileId: profile.id,
          tagId,
        })),
      );
    }
  });

  redirect("/business-auth/setup/onboarding?step=2");
}

const VALID_LEAD_TIMES = [
  "same_day",
  "1_day",
  "2_days",
  "3_days",
  "4_days",
  "5_days",
] as const;
type LeadTimeValue = (typeof VALID_LEAD_TIMES)[number];

export async function saveStep2(data: {
  pickupAddress: string;
  pickupDays: string[];
  pickupFrom: string;
  pickupTo: string;
  leadTime: string;
  maxCapacity: string;
  delivery: string;
  acceptsSpecialRequests: boolean;
}): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated." };

  const pickupAddress = data.pickupAddress.trim();
  if (!pickupAddress) return { error: "Pickup address is required." };
  if (!(VALID_LEAD_TIMES as readonly string[]).includes(data.leadTime))
    return { error: "Select an order lead time." };

  const leadTime = data.leadTime as LeadTimeValue;
  const delivery =
    data.delivery === "self" ? ("self" as const) : ("none" as const);
  const rawCap = Number.parseInt(data.maxCapacity, 10);
  const maxCapacity = Number.isNaN(rawCap)
    ? null
    : Math.min(Math.max(rawCap, 5), 500);

  const [profile] = await db
    .select({ currentSetupStep: cookProfiles.currentSetupStep })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);
  if (!profile) return { error: "Profile not found." };

  await db
    .update(cookProfiles)
    .set({
      pickupAddress,
      pickupDays: data.pickupDays,
      pickupFrom: data.pickupFrom || null,
      pickupTo: data.pickupTo || null,
      leadTime,
      maxCapacity,
      delivery,
      acceptsSpecialRequests: data.acceptsSpecialRequests,
      currentSetupStep: Math.max(profile.currentSetupStep, 3),
    })
    .where(eq(cookProfiles.userId, session.user.id));

  redirect("/business-auth/setup/onboarding?step=3");
}
