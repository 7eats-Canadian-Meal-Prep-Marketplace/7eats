import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db, dbPool } from "@/db";
import { cookPickupWindows, cookProfiles } from "@/db/schema";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DayOfWeek = (typeof DAY_ORDER)[number];

const pickupWindowSchema = z
  .object({
    day: z.enum(DAY_ORDER),
    from: z.string().regex(/^\d{2}:\d{2}$/),
    to: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((w) => w.to > w.from, { message: "to must be after from" });

const bodySchema = z.object({
  pickupWindows: z.array(pickupWindowSchema).optional(),
  leadTime: z
    .enum(["same_day", "1_day", "2_days", "3_days", "4_days", "5_days"])
    .optional(),
  maxCapacity: z.number().int().min(1).max(1000).optional(),
  delivery: z.enum(["none", "self"]).optional(),
});

function formatTime(t: string): string {
  return t.slice(0, 5);
}

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [[cook], windows] = await Promise.all([
      db
        .select({
          leadTime: cookProfiles.leadTime,
          maxCapacity: cookProfiles.maxCapacity,
          delivery: cookProfiles.delivery,
        })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1),
      db
        .select({
          dayOfWeek: cookPickupWindows.dayOfWeek,
          fromTime: cookPickupWindows.fromTime,
          toTime: cookPickupWindows.toTime,
        })
        .from(cookPickupWindows)
        .where(eq(cookPickupWindows.cookId, cookId)),
    ]);

    if (!cook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    const sortedWindows = windows
      .sort(
        (a, b) =>
          DAY_ORDER.indexOf(a.dayOfWeek as DayOfWeek) -
          DAY_ORDER.indexOf(b.dayOfWeek as DayOfWeek),
      )
      .map((w) => ({
        day: w.dayOfWeek,
        from: formatTime(w.fromTime),
        to: formatTime(w.toTime),
      }));

    return NextResponse.json({
      success: true,
      data: { ...cook, pickupWindows: sortedWindows },
    });
  } catch (err) {
    console.error("[dashboard/availability GET]", err);
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

  const { pickupWindows, ...profileFields } = parsed.data;

  if (!pickupWindows && Object.keys(profileFields).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  try {
    await dbPool.transaction(async (tx) => {
      if (Object.keys(profileFields).length > 0) {
        await tx
          .update(cookProfiles)
          .set(profileFields)
          .where(eq(cookProfiles.id, cookId));
      }

      if (pickupWindows !== undefined) {
        await tx
          .delete(cookPickupWindows)
          .where(eq(cookPickupWindows.cookId, cookId));

        if (pickupWindows.length > 0) {
          await tx.insert(cookPickupWindows).values(
            pickupWindows.map((w) => ({
              cookId,
              dayOfWeek: w.day,
              fromTime: w.from,
              toTime: w.to,
            })),
          );
        }
      }
    });

    const [[updatedCook], updatedWindows] = await Promise.all([
      db
        .select({
          leadTime: cookProfiles.leadTime,
          maxCapacity: cookProfiles.maxCapacity,
          delivery: cookProfiles.delivery,
        })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1),
      db
        .select({
          dayOfWeek: cookPickupWindows.dayOfWeek,
          fromTime: cookPickupWindows.fromTime,
          toTime: cookPickupWindows.toTime,
        })
        .from(cookPickupWindows)
        .where(eq(cookPickupWindows.cookId, cookId)),
    ]);

    if (!updatedCook) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    const sortedWindows = updatedWindows
      .sort(
        (a, b) =>
          DAY_ORDER.indexOf(a.dayOfWeek as DayOfWeek) -
          DAY_ORDER.indexOf(b.dayOfWeek as DayOfWeek),
      )
      .map((w) => ({
        day: w.dayOfWeek,
        from: formatTime(w.fromTime),
        to: formatTime(w.toTime),
      }));

    return NextResponse.json({
      success: true,
      data: { ...updatedCook, pickupWindows: sortedWindows },
    });
  } catch (err) {
    console.error("[dashboard/availability PUT]", err);
    return NextResponse.json(
      { error: "Failed to update availability." },
      { status: 500 },
    );
  }
}
