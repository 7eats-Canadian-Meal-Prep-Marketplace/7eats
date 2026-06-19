import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookNotificationReads } from "@/db/schema";
import { parseNotifId } from "../_lib";

const bodySchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 },
    );
  }

  const entries: {
    cookId: string;
    entityType: "order_new" | "order_cancelled" | "review";
    entityId: string;
  }[] = [];

  for (const id of parsed.data.ids) {
    const result = parseNotifId(id);
    if (!result) continue;
    entries.push({
      cookId,
      entityType: result.entityType as
        | "order_new"
        | "order_cancelled"
        | "review",
      entityId: result.entityId,
    });
  }

  if (entries.length === 0) {
    return NextResponse.json({ success: true });
  }

  try {
    await db
      .insert(cookNotificationReads)
      .values(entries)
      .onConflictDoNothing();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[dashboard/notifications mark-read]", err);
    return NextResponse.json(
      { error: "Failed to mark notifications as read." },
      { status: 500 },
    );
  }
}
