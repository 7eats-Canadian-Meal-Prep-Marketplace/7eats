import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser, authUserTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { normalizeClientNotificationPrefs } from "@/lib/client-notification-preferences";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ notificationPreferences: authUser.notificationPreferences })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const data = normalizeClientNotificationPrefs(user.notificationPreferences);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[user/notifications/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences." },
      { status: 500 },
    );
  }
}

const updateNotificationsSchema = z.object({
  notifs: z
    .object({
      order_updates: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  channels: z
    .object({
      sms: z.boolean().optional(),
      email: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
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

  const parsed = updateNotificationsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const [user] = await db
      .select({ notificationPreferences: authUser.notificationPreferences })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const current = normalizeClientNotificationPrefs(
      user.notificationPreferences,
    );

    const mergedPrefs = normalizeClientNotificationPrefs({
      notifs: { ...current.notifs, ...(parsed.data.notifs ?? {}) },
      channels: { ...current.channels, ...(parsed.data.channels ?? {}) },
    });

    if (!mergedPrefs.channels.sms && !mergedPrefs.channels.email) {
      return NextResponse.json(
        { error: "At least one notification channel must be enabled." },
        { status: 400 },
      );
    }

    await db
      .update(authUserTable)
      .set({ notificationPreferences: mergedPrefs })
      .where(eq(authUser.id, session.user.id));

    return NextResponse.json({ success: true, data: mergedPrefs });
  } catch (err) {
    console.error("[user/notifications/PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update notification preferences." },
      { status: 500 },
    );
  }
}
