import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";

const bodySchema = z.object({
  pickupDays: z
    .array(
      z.enum([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ]),
    )
    .optional(),
  pickupFrom: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  pickupTo: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  leadTime: z
    .enum(["same_day", "1_day", "2_days", "3_days", "4_days", "5_days"])
    .optional(),
  maxCapacity: z.number().int().min(1).max(1000).optional(),
  delivery: z.enum(["none", "self"]).optional(),
});

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [cook] = await db
      .select({
        pickupDays: cookProfiles.pickupDays,
        pickupFrom: cookProfiles.pickupFrom,
        pickupTo: cookProfiles.pickupTo,
        leadTime: cookProfiles.leadTime,
        maxCapacity: cookProfiles.maxCapacity,
        delivery: cookProfiles.delivery,
      })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!cook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: cook });
  } catch (err) {
    console.error("[dashboard/availability]", err);
    return NextResponse.json(
      { error: "Failed to fetch availability." },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 },
    );
  }

  const validData = parsed.data;

  if (Object.keys(validData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  if (validData.pickupFrom && validData.pickupTo) {
    if (validData.pickupTo <= validData.pickupFrom) {
      return NextResponse.json(
        { error: "pickupTo must be after pickupFrom." },
        { status: 400 },
      );
    }
  }

  try {
    const [updated] = await db
      .update(cookProfiles)
      .set(validData)
      .where(eq(cookProfiles.id, cookId))
      .returning({
        pickupDays: cookProfiles.pickupDays,
        pickupFrom: cookProfiles.pickupFrom,
        pickupTo: cookProfiles.pickupTo,
        leadTime: cookProfiles.leadTime,
        maxCapacity: cookProfiles.maxCapacity,
        delivery: cookProfiles.delivery,
      });

    if (!updated) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[dashboard/availability]", err);
    return NextResponse.json(
      { error: "Failed to update availability." },
      { status: 500 },
    );
  }
}
