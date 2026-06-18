import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, dbPool } from "@/db";
import {
  cookCertifications,
  cookPickupWindows,
  cookProfiles,
  cookProfileTags,
  tags,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { uploadAvatar } from "@/lib/storage/avatars";
import { uploadCert } from "@/lib/storage/certs";
import { sniffFileType } from "@/lib/upload-validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ step: string }> },
) {
  const { step } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  switch (step) {
    case "1":
      return step1(req, session.user.id);
    case "2":
      return step2(req, session.user.id);
    case "3":
      return step3(req, session.user.id);
    case "4":
      return step4(req, session.user.id);
    default:
      return NextResponse.json({ error: "Invalid step." }, { status: 400 });
  }
}

// ── Step 1: Cook profile ───────────────────────────────────────

async function step1(req: Request, userId: string) {
  const fd = await req.formData();
  const displayName = ((fd.get("displayName") as string) ?? "").trim();
  const bio = ((fd.get("bio") as string) ?? "").trim();
  const socialLink = ((fd.get("socialLink") as string) ?? "").trim() || null;
  const cuisineSlugs = ((fd.get("cuisines") as string) ?? "")
    .split(",")
    .filter(Boolean);
  const nicheSlugs = ((fd.get("niches") as string) ?? "")
    .split(",")
    .filter(Boolean);
  const dietarySlugs = ((fd.get("dietary") as string) ?? "")
    .split(",")
    .filter(Boolean);
  const photo = fd.get("photo") as File | null;

  if (!displayName)
    return NextResponse.json(
      { error: "Display name is required." },
      { status: 400 },
    );
  if (bio.length < 100 || bio.length > 500)
    return NextResponse.json(
      { error: "Bio must be between 100 and 500 characters." },
      { status: 400 },
    );
  if (cuisineSlugs.length === 0)
    return NextResponse.json(
      { error: "Select at least one cuisine type." },
      { status: 400 },
    );

  let photoUrl: string | undefined;
  if (photo && photo.size > 0) {
    if (!["image/jpeg", "image/png"].includes(photo.type))
      return NextResponse.json(
        { error: "Photo must be JPEG or PNG." },
        { status: 400 },
      );
    if (photo.size > 5 * 1024 * 1024)
      return NextResponse.json(
        { error: "Photo must be smaller than 5 MB." },
        { status: 400 },
      );
    const buf = Buffer.from(await photo.arrayBuffer());
    const sniffed = sniffFileType(buf);
    if (sniffed !== "image/jpeg" && sniffed !== "image/png") {
      return NextResponse.json(
        { error: "Photo must be a valid JPEG or PNG." },
        { status: 400 },
      );
    }
    try {
      photoUrl = await uploadAvatar(userId, photo.name, buf, sniffed);
    } catch {
      return NextResponse.json(
        { error: "Photo upload failed. Please try again." },
        { status: 500 },
      );
    }
  }

  const [profile] = await db
    .select({
      id: cookProfiles.id,
      currentSetupStep: cookProfiles.currentSetupStep,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, userId))
    .limit(1);
  if (!profile)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const allSlugs = [...cuisineSlugs, ...nicheSlugs, ...dietarySlugs];
  const resolvedTags =
    allSlugs.length > 0
      ? await db
          .select({ id: tags.id })
          .from(tags)
          .where(inArray(tags.slug, allSlugs))
      : [];

  await dbPool.transaction(async (tx) => {
    await tx
      .update(cookProfiles)
      .set({
        displayName,
        bio,
        socialLink,
        ...(photoUrl !== undefined ? { photoUrl } : {}),
        currentSetupStep: Math.max(profile.currentSetupStep, 2),
      })
      .where(eq(cookProfiles.userId, userId));

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

  return NextResponse.json({ success: true });
}

// ── Step 2: Operations ─────────────────────────────────────────

const VALID_LEAD_TIMES = [
  "same_day",
  "1_day",
  "2_days",
  "3_days",
  "4_days",
  "5_days",
] as const;
type LeadTimeValue = (typeof VALID_LEAD_TIMES)[number];

async function step2(req: Request, userId: string) {
  const data = await req.json();
  const pickupStreet = (data.pickupStreet ?? "").trim();
  const pickupUnit = (data.pickupUnit ?? "").trim() || null;
  const pickupCity = (data.pickupCity ?? "").trim();
  const pickupProvince = (data.pickupProvince ?? "").trim();
  const pickupPostal = (data.pickupPostal ?? "").trim();
  const pickupLat = typeof data.pickupLat === "number" ? data.pickupLat : null;
  const pickupLng = typeof data.pickupLng === "number" ? data.pickupLng : null;
  // pickupPlaceId may be null if Mapbox returns empty mapbox_id; downstream distance API must handle null
  const pickupPlaceId = (data.pickupPlaceId ?? "").trim() || null;

  if (
    !pickupStreet ||
    !pickupCity ||
    !pickupProvince ||
    !pickupPostal ||
    pickupLat === null ||
    pickupLng === null
  )
    return NextResponse.json(
      { error: "Complete pickup address with geocoding is required." },
      { status: 400 },
    );
  if (!(VALID_LEAD_TIMES as readonly string[]).includes(data.leadTime))
    return NextResponse.json(
      { error: "Select an order lead time." },
      { status: 400 },
    );

  const leadTime = data.leadTime as LeadTimeValue;
  const delivery =
    data.delivery === "self" ? ("self" as const) : ("none" as const);
  const rawCap = Number.parseInt(data.maxCapacity, 10);
  const maxCapacity = Number.isNaN(rawCap)
    ? null
    : Math.min(Math.max(rawCap, 5), 500);

  const windows: Array<{ day: string; from: string; to: string }> =
    Array.isArray(data.pickupWindows) ? data.pickupWindows : [];

  const [profile] = await db
    .select({
      id: cookProfiles.id,
      currentSetupStep: cookProfiles.currentSetupStep,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, userId))
    .limit(1);
  if (!profile)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  await dbPool.transaction(async (tx) => {
    await tx
      .update(cookProfiles)
      .set({
        pickupStreet,
        pickupUnit,
        pickupCity,
        pickupProvince,
        pickupPostal,
        pickupLat,
        pickupLng,
        pickupPlaceId,
        leadTime,
        maxCapacity,
        delivery,
        acceptsSpecialRequests: data.acceptsSpecialRequests,
        cancellationAllowed: data.cancellationAllowed === true,
        currentSetupStep: Math.max(profile.currentSetupStep, 3),
      })
      .where(eq(cookProfiles.userId, userId));

    await tx
      .delete(cookPickupWindows)
      .where(eq(cookPickupWindows.cookId, profile.id));

    if (windows.length > 0) {
      await tx.insert(cookPickupWindows).values(
        windows.map((w) => ({
          cookId: profile.id,
          dayOfWeek: w.day,
          fromTime: w.from,
          toTime: w.to,
        })),
      );
    }
  });

  return NextResponse.json({ success: true });
}

// ── Step 3: Compliance certificate ────────────────────────────

async function step3(req: Request, userId: string) {
  const fd = await req.formData();
  const certIdNumber = ((fd.get("certIdNumber") as string) ?? "").trim();
  const certFullName = ((fd.get("certFullName") as string) ?? "").trim();
  const certExpiry = ((fd.get("certExpiry") as string) ?? "").trim();
  const certPhoto = fd.get("certPhoto") as File | null;

  if (!certIdNumber)
    return NextResponse.json(
      { error: "Certificate ID number is required." },
      { status: 400 },
    );
  if (!certFullName)
    return NextResponse.json(
      { error: "Full name on certificate is required." },
      { status: 400 },
    );
  if (!certExpiry)
    return NextResponse.json(
      { error: "Certificate expiry date is required." },
      { status: 400 },
    );

  const expiresAt = new Date(certExpiry);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())
    return NextResponse.json(
      { error: "Certificate expiry must be a future date." },
      { status: 400 },
    );

  const [profile] = await db
    .select({
      id: cookProfiles.id,
      currentSetupStep: cookProfiles.currentSetupStep,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, userId))
    .limit(1);
  if (!profile)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  let fileUrl: string | undefined;
  if (certPhoto && certPhoto.size > 0) {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(certPhoto.type))
      return NextResponse.json(
        { error: "Certificate file must be JPEG, PNG, or PDF." },
        { status: 400 },
      );
    if (certPhoto.size > 10 * 1024 * 1024)
      return NextResponse.json(
        { error: "Certificate file must be smaller than 10 MB." },
        { status: 400 },
      );
    const buf = Buffer.from(await certPhoto.arrayBuffer());
    const sniffed = sniffFileType(buf);
    if (
      sniffed !== "image/jpeg" &&
      sniffed !== "image/png" &&
      sniffed !== "application/pdf"
    ) {
      return NextResponse.json(
        { error: "Certificate file must be a valid JPEG, PNG, or PDF." },
        { status: 400 },
      );
    }
    try {
      fileUrl = await uploadCert(profile.id, certPhoto.name, buf, sniffed);
    } catch {
      return NextResponse.json(
        { error: "Certificate upload failed. Please try again." },
        { status: 500 },
      );
    }
  }

  await dbPool.transaction(async (tx) => {
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
      .where(eq(cookProfiles.userId, userId));
  });

  return NextResponse.json({ success: true });
}

// ── Step 4: Payment & TOS ──────────────────────────────────────

async function step4(req: Request, userId: string) {
  const { tosAccepted } = await req.json();
  if (!tosAccepted)
    return NextResponse.json(
      { error: "Accept the terms of service to continue." },
      { status: 400 },
    );

  const [profile] = await db
    .select({
      currentSetupStep: cookProfiles.currentSetupStep,
      stripeAccountId: cookProfiles.stripeAccountId,
    })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, userId))
    .limit(1);
  if (!profile)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  if (!profile.stripeAccountId)
    return NextResponse.json(
      { error: "Connect your payment account before continuing." },
      { status: 400 },
    );

  await db
    .update(cookProfiles)
    .set({
      tosAcceptedAt: new Date(),
      setupComplete: true,
      currentSetupStep: Math.max(profile.currentSetupStep, 4),
    })
    .where(eq(cookProfiles.userId, userId));

  return NextResponse.json({ success: true });
}
