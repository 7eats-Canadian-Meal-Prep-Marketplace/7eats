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
import { withDeliveryDefaults } from "@/lib/delivery-pricing";
import { rebuildCookSearchIndexSafe } from "@/lib/search/index-builder";
import { uploadAvatar, uploadBanner } from "@/lib/storage/avatars";
import { uploadCert } from "@/lib/storage/certs";
import { getStripe } from "@/lib/stripe";
import {
  isStripeFullyConnected,
  readStripeConnectAccountStatus,
} from "@/lib/stripe-connect";
import { sniffFileType } from "@/lib/upload-validation";
import { normalizeUrl } from "@/lib/url";

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
  const socialLinkRaw = ((fd.get("socialLink") as string) ?? "").trim();
  const socialLink = socialLinkRaw ? normalizeUrl(socialLinkRaw) : null;
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
  const banner = fd.get("banner") as File | null;

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
  if (socialLinkRaw && !socialLink)
    return NextResponse.json(
      { error: "Enter a valid social link URL, or leave it blank." },
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

  let bannerUrl: string | undefined;
  if (banner && banner.size > 0) {
    if (!["image/jpeg", "image/png"].includes(banner.type))
      return NextResponse.json(
        { error: "Banner must be JPEG or PNG." },
        { status: 400 },
      );
    if (banner.size > 8 * 1024 * 1024)
      return NextResponse.json(
        { error: "Banner must be smaller than 8 MB." },
        { status: 400 },
      );
    const buf = Buffer.from(await banner.arrayBuffer());
    const sniffed = sniffFileType(buf);
    if (sniffed !== "image/jpeg" && sniffed !== "image/png") {
      return NextResponse.json(
        { error: "Banner must be a valid JPEG or PNG." },
        { status: 400 },
      );
    }
    try {
      bannerUrl = await uploadBanner(userId, banner.name, buf, sniffed);
    } catch {
      return NextResponse.json(
        { error: "Banner upload failed. Please try again." },
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
        ...(bannerUrl !== undefined ? { bannerUrl } : {}),
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

  // Name, bio and cuisine/niche tags feed the search document.
  rebuildCookSearchIndexSafe(profile.id);

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
  const offersPickup = data.offersPickup !== false;
  const offersDelivery = delivery === "self";

  const pickupWindows: Array<{ day: string; from: string; to: string }> =
    offersPickup && Array.isArray(data.pickupWindows) ? data.pickupWindows : [];
  const deliveryWindows: Array<{ day: string; from: string; to: string }> =
    offersDelivery && Array.isArray(data.deliveryWindows)
      ? data.deliveryWindows
      : [];

  if (!offersPickup && !offersDelivery)
    return NextResponse.json(
      { error: "Offer pickup, delivery, or both." },
      { status: 400 },
    );
  if (offersPickup && pickupWindows.length === 0)
    return NextResponse.json(
      { error: "Add at least one pickup day." },
      { status: 400 },
    );
  if (offersDelivery && deliveryWindows.length === 0)
    return NextResponse.json(
      { error: "Add at least one delivery day." },
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

  await dbPool.transaction(async (tx) => {
    const deliveryZone = offersDelivery
      ? withDeliveryDefaults({
          maxDeliveryKm: null,
          deliveryRatePerKm: null,
        })
      : null;

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
        offersPickup,
        delivery,
        ...(offersDelivery
          ? {
              maxDeliveryKm: deliveryZone?.maxDeliveryKm ?? null,
              deliveryRatePerKm:
                deliveryZone?.deliveryRatePerKm != null
                  ? String(deliveryZone.deliveryRatePerKm)
                  : null,
              deliveryFlatFee: "0",
            }
          : {
              maxDeliveryKm: null,
              deliveryRatePerKm: null,
              deliveryFlatFee: null,
            }),
        acceptsSpecialRequests: data.acceptsSpecialRequests,
        cancellationAllowed: data.cancellationAllowed === true,
        currentSetupStep: Math.max(profile.currentSetupStep, 3),
      })
      .where(eq(cookProfiles.userId, userId));

    await tx
      .delete(cookPickupWindows)
      .where(eq(cookPickupWindows.cookId, profile.id));

    const rows = [
      ...pickupWindows.map((w) => ({
        cookId: profile.id,
        windowType: "pickup" as const,
        dayOfWeek: w.day,
        fromTime: w.from,
        toTime: w.to,
      })),
      ...deliveryWindows.map((w) => ({
        cookId: profile.id,
        windowType: "delivery" as const,
        dayOfWeek: w.day,
        fromTime: w.from,
        toTime: w.to,
      })),
    ];
    if (rows.length > 0) {
      await tx.insert(cookPickupWindows).values(rows);
    }
  });

  // Pickup geo, delivery mode and offers-pickup feed search reachability.
  rebuildCookSearchIndexSafe(profile.id);

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
      id: cookProfiles.id,
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

  try {
    const account = await getStripe().v2.core.accounts.retrieve(
      profile.stripeAccountId,
      { include: ["configuration.recipient", "requirements"] },
    );
    const stripeStatus = readStripeConnectAccountStatus(account);
    if (!isStripeFullyConnected(stripeStatus)) {
      return NextResponse.json(
        {
          error:
            "Finish Stripe Connect onboarding before continuing. Open Connect with Stripe and complete any pending steps.",
        },
        { status: 400 },
      );
    }
  } catch (err) {
    console.error("[onboarding/step4] stripe retrieve", err);
    return NextResponse.json(
      { error: "Could not verify your Stripe account. Try again." },
      { status: 500 },
    );
  }

  await db
    .update(cookProfiles)
    .set({
      tosAcceptedAt: new Date(),
      setupComplete: true,
      currentSetupStep: Math.max(profile.currentSetupStep, 4),
    })
    .where(eq(cookProfiles.userId, userId));

  // setup_complete flips the cook into public visibility for search.
  rebuildCookSearchIndexSafe(profile.id);

  return NextResponse.json({ success: true });
}
