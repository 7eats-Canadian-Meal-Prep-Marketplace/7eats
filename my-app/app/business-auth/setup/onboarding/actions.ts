"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  cookCertifications,
  cookProfiles,
  cookProfileTags,
  tags,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { uploadAvatar } from "@/lib/storage/avatars";
import { uploadCert } from "@/lib/storage/certs";

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

export async function saveStep3(
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated." };

  const certIdNumber = ((formData.get("certIdNumber") as string) ?? "").trim();
  const certFullName = ((formData.get("certFullName") as string) ?? "").trim();
  const certExpiry = ((formData.get("certExpiry") as string) ?? "").trim();
  const certPhoto = formData.get("certPhoto") as File | null;

  if (!certIdNumber) return { error: "Certificate ID number is required." };
  if (!certFullName) return { error: "Full name on certificate is required." };
  if (!certExpiry) return { error: "Certificate expiry date is required." };

  const expiresAt = new Date(certExpiry);
  if (isNaN(expiresAt.getTime()) || expiresAt <= new Date())
    return { error: "Certificate expiry must be a future date." };

  const [profile] = await db
    .select({
      id: cookProfiles.id,
      currentSetupStep: cookProfiles.currentSetupStep,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);
  if (!profile) return { error: "Profile not found." };

  let fileUrl: string | undefined;
  if (certPhoto && certPhoto.size > 0) {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(certPhoto.type))
      return { error: "Certificate file must be JPEG, PNG, or PDF." };
    if (certPhoto.size > 10 * 1024 * 1024)
      return { error: "Certificate file must be smaller than 10 MB." };
    try {
      const buf = Buffer.from(await certPhoto.arrayBuffer());
      fileUrl = await uploadCert(
        profile.id,
        certPhoto.name,
        buf,
        certPhoto.type,
      );
    } catch {
      return { error: "Certificate upload failed. Please try again." };
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(cookCertifications)
      .where(
        and(
          eq(cookCertifications.cookId, profile.id),
          eq(cookCertifications.status, "pending_review"),
        ),
      );

    await tx.insert(cookCertifications).values({
      cookId: profile.id,
      name: "Food Handler Certificate",
      holderName: certFullName,
      certificateNumber: certIdNumber,
      expiresAt,
      ...(fileUrl !== undefined ? { fileUrl } : {}),
    });

    await tx
      .update(cookProfiles)
      .set({ currentSetupStep: Math.max(profile.currentSetupStep, 4) })
      .where(eq(cookProfiles.userId, session.user.id));
  });

  redirect("/business-auth/setup/onboarding?step=4");
}

export async function mockConnectStripe(): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated." };

  await db
    .update(cookProfiles)
    .set({ stripeAccountId: `mock_acct_${session.user.id.slice(0, 8)}` })
    .where(eq(cookProfiles.userId, session.user.id));

  return {};
}

export async function saveStep4(
  tosAccepted: boolean,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated." };
  if (!tosAccepted)
    return { error: "Accept the terms of service to continue." };

  const [profile] = await db
    .select({
      currentSetupStep: cookProfiles.currentSetupStep,
      stripeAccountId: cookProfiles.stripeAccountId,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);
  if (!profile) return { error: "Profile not found." };
  if (!profile.stripeAccountId)
    return { error: "Connect your payment account before continuing." };

  await db
    .update(cookProfiles)
    .set({
      tosAcceptedAt: new Date(),
      setupComplete: true,
      currentSetupStep: Math.max(profile.currentSetupStep, 4),
    })
    .where(eq(cookProfiles.userId, session.user.id));

  redirect("/business/dashboard");
}
