import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getClientSession,
  unauthorized,
} from "@/app/api/subscriptions/_lib/client-auth";
import { db } from "@/db";
import { authUser, cookProfiles, listings, savedListings } from "@/db/schema";

const saveListingSchema = z.object({
  listingId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  try {
    const rows = await db
      .select({
        id: listings.id,
        title: listings.title,
        description: listings.description,
        cookId: listings.cookId,
        cookFirstName: authUser.firstName,
        cookLastName: authUser.lastName,
        type: listings.type,
        subscriptionEnabled: listings.subscriptionEnabled,
        basePrice: listings.basePrice,
        currency: listings.currency,
        coverPhotoUrl: listings.coverPhotoUrl,
        savedAt: savedListings.createdAt,
      })
      .from(savedListings)
      .innerJoin(listings, eq(savedListings.listingId, listings.id))
      .innerJoin(cookProfiles, eq(listings.cookId, cookProfiles.id))
      .innerJoin(authUser, eq(cookProfiles.userId, authUser.id))
      .where(
        and(
          eq(savedListings.userId, session.user.id),
          eq(listings.status, "active"),
        ),
      );

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      cookId: r.cookId,
      cookName: [r.cookFirstName, r.cookLastName].filter(Boolean).join(" "),
      cookFirstName: r.cookFirstName ?? null,
      type: r.type,
      subscriptionEnabled: r.subscriptionEnabled,
      basePrice: parseFloat(r.basePrice),
      currency: r.currency,
      coverPhotoUrl: r.coverPhotoUrl ?? null,
      savedAt:
        r.savedAt instanceof Date ? r.savedAt.toISOString() : String(r.savedAt),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[favourites/listings/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch saved listings." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = saveListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { listingId } = parsed.data;

  try {
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.status, "active")))
      .limit(1);

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    }

    const [existing] = await db
      .select({ id: savedListings.id })
      .from(savedListings)
      .where(
        and(
          eq(savedListings.userId, session.user.id),
          eq(savedListings.listingId, listingId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Already saved." }, { status: 409 });
    }

    await db.insert(savedListings).values({
      userId: session.user.id,
      listingId,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[favourites/listings/POST]", err);
    return NextResponse.json(
      { error: "Failed to save listing." },
      { status: 500 },
    );
  }
}
