import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { userAddresses } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { NormalizedAddress } from "@/lib/types/address";

// ─── GET /api/user/address ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const [row] = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, session.user.id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ address: null });
    }

    const address: NormalizedAddress | null =
      row.serviceStreet &&
      row.serviceCity &&
      row.serviceProvince &&
      row.servicePostal &&
      row.serviceLat !== null &&
      row.serviceLat !== undefined &&
      row.serviceLng !== null &&
      row.serviceLng !== undefined &&
      row.servicePlaceId
        ? {
            street: row.serviceStreet,
            unit: row.serviceUnit ?? undefined,
            city: row.serviceCity,
            province: row.serviceProvince,
            postal: row.servicePostal,
            lat: row.serviceLat,
            lng: row.serviceLng,
            placeId: row.servicePlaceId,
          }
        : null;

    return NextResponse.json({ address });
  } catch (err) {
    console.error("[user/address/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch address." },
      { status: 500 },
    );
  }
}

// ─── PUT /api/user/address ────────────────────────────────────────────────────

const upsertAddressSchema = z.object({
  street: z.string().min(1),
  unit: z.string().optional().nullable(),
  city: z.string().min(1),
  province: z.string().min(2).max(2),
  postal: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = upsertAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { street, unit, city, province, postal, lat, lng, placeId } =
    parsed.data;

  try {
    const id = `${session.user.id}-address`;
    await db
      .insert(userAddresses)
      .values({
        id,
        userId: session.user.id,
        serviceStreet: street,
        serviceUnit: unit ?? null,
        serviceCity: city,
        serviceProvince: province,
        servicePostal: postal,
        serviceLat: lat,
        serviceLng: lng,
        servicePlaceId: placeId,
      })
      .onConflictDoUpdate({
        target: userAddresses.userId,
        set: {
          serviceStreet: street,
          serviceUnit: unit ?? null,
          serviceCity: city,
          serviceProvince: province,
          servicePostal: postal,
          serviceLat: lat,
          serviceLng: lng,
          servicePlaceId: placeId,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[user/address/PUT]", err);
    return NextResponse.json(
      { error: "Failed to save address." },
      { status: 500 },
    );
  }
}
