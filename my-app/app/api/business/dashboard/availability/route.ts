import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
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

const windowSchema = z
  .object({
    day: z.enum(DAY_ORDER),
    from: z.string().regex(/^\d{2}:\d{2}$/),
    to: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((w) => w.to > w.from, { message: "to must be after from" });

const bodySchema = z.object({
  pickupWindows: z.array(windowSchema).optional(),
  deliveryWindows: z.array(windowSchema).optional(),
  offersPickup: z.boolean().optional(),
  leadTime: z
    .enum(["same_day", "1_day", "2_days", "3_days", "4_days", "5_days"])
    .optional(),
  delivery: z.enum(["none", "self"]).optional(),
});

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function sortWindows(
  rows: Array<{ dayOfWeek: string; fromTime: string; toTime: string }>,
) {
  return rows
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
}

function splitWindows(
  rows: Array<{
    windowType: string;
    dayOfWeek: string;
    fromTime: string;
    toTime: string;
  }>,
) {
  return {
    pickupWindows: sortWindows(rows.filter((w) => w.windowType === "pickup")),
    deliveryWindows: sortWindows(
      rows.filter((w) => w.windowType === "delivery"),
    ),
  };
}

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const [[cook], windows] = await Promise.all([
      db
        .select({
          leadTime: cookProfiles.leadTime,
          offersPickup: cookProfiles.offersPickup,
          delivery: cookProfiles.delivery,
        })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1),
      db
        .select({
          windowType: cookPickupWindows.windowType,
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

    const { pickupWindows, deliveryWindows } = splitWindows(windows);

    return NextResponse.json({
      success: true,
      data: { ...cook, pickupWindows, deliveryWindows },
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

  const {
    pickupWindows,
    deliveryWindows,
    offersPickup: offersPickupBody,
    ...profileFields
  } = parsed.data;

  const updatingWindows =
    pickupWindows !== undefined || deliveryWindows !== undefined;

  if (
    !updatingWindows &&
    Object.keys(profileFields).length === 0 &&
    offersPickupBody === undefined
  ) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  try {
    const [current] = await db
      .select({
        delivery: cookProfiles.delivery,
        offersPickup: cookProfiles.offersPickup,
      })
      .from(cookProfiles)
      .where(eq(cookProfiles.id, cookId))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Cook not found." }, { status: 404 });
    }

    const delivery =
      profileFields.delivery ??
      (current.delivery === "self" ? ("self" as const) : ("none" as const));
    const offersPickup = offersPickupBody ?? current.offersPickup;
    const offersDelivery = delivery === "self";

    if (updatingWindows) {
      const pickup = pickupWindows ?? [];
      const deliveryWins = deliveryWindows ?? [];

      if (!offersPickup && !offersDelivery) {
        return NextResponse.json(
          { error: "Offer pickup, delivery, or both." },
          { status: 400 },
        );
      }
      if (offersPickup && pickup.length === 0) {
        return NextResponse.json(
          { error: "Add at least one pickup day." },
          { status: 400 },
        );
      }
      if (offersDelivery && deliveryWins.length === 0) {
        return NextResponse.json(
          { error: "Add at least one delivery day." },
          { status: 400 },
        );
      }
    }

    await dbPool.transaction(async (tx) => {
      const profileUpdate: {
        leadTime?: (typeof profileFields)["leadTime"];
        delivery?: "none" | "self";
        offersPickup?: boolean;
      } = { ...profileFields };

      if (offersPickupBody !== undefined) {
        profileUpdate.offersPickup = offersPickupBody;
      } else if (updatingWindows && pickupWindows !== undefined) {
        profileUpdate.offersPickup = pickupWindows.length > 0;
      }
      if (profileFields.delivery === "none") {
        profileUpdate.offersPickup = offersPickupBody ?? true;
      }

      if (Object.keys(profileUpdate).length > 0) {
        await tx
          .update(cookProfiles)
          .set(profileUpdate)
          .where(eq(cookProfiles.id, cookId));
      }

      if (updatingWindows) {
        await tx
          .delete(cookPickupWindows)
          .where(eq(cookPickupWindows.cookId, cookId));

        const rows = [
          ...(pickupWindows ?? []).map((w) => ({
            cookId,
            windowType: "pickup" as const,
            dayOfWeek: w.day,
            fromTime: w.from,
            toTime: w.to,
          })),
          ...(deliveryWindows ?? []).map((w) => ({
            cookId,
            windowType: "delivery" as const,
            dayOfWeek: w.day,
            fromTime: w.from,
            toTime: w.to,
          })),
        ];
        if (rows.length > 0) {
          await tx.insert(cookPickupWindows).values(rows);
        }
      }
    });

    const [[updatedCook], updatedWindows] = await Promise.all([
      db
        .select({
          leadTime: cookProfiles.leadTime,
          offersPickup: cookProfiles.offersPickup,
          delivery: cookProfiles.delivery,
        })
        .from(cookProfiles)
        .where(eq(cookProfiles.id, cookId))
        .limit(1),
      db
        .select({
          windowType: cookPickupWindows.windowType,
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

    const { pickupWindows: pw, deliveryWindows: dw } =
      splitWindows(updatedWindows);

    return NextResponse.json({
      success: true,
      data: { ...updatedCook, pickupWindows: pw, deliveryWindows: dw },
    });
  } catch (err) {
    console.error("[dashboard/availability PUT]", err);
    return NextResponse.json(
      { error: "Failed to update availability." },
      { status: 500 },
    );
  }
}
