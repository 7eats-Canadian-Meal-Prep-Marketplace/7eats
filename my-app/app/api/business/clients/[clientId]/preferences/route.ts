import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { conversations, orders, userPreferences } from "@/db/schema";

// ─── GET /api/business/clients/[clientId]/preferences ──────────────────────────
// Read-only. Returns the client's onboarding preferences (dietary, allergies,
// goals, why-meal-prep) for a cook who actually does business with that client.
// A cook is "linked" to a client when they share at least one order or
// conversation. There is intentionally no write handler — the business side can
// view but never edit client preferences.

const clientIdSchema = z.string().min(1);

export type Params = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { clientId } = await params;
  const parsed = clientIdSchema.safeParse(clientId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client ID." }, { status: 400 });
  }

  try {
    // Authorization: the cook may only view a client they do business with.
    const [orderLink, conversationLink] = await Promise.all([
      db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.cookId, cookId), eq(orders.clientId, clientId)))
        .limit(1),
      db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.cookId, cookId),
            eq(conversations.clientId, clientId),
          ),
        )
        .limit(1),
    ]);

    if (orderLink.length === 0 && conversationLink.length === 0) {
      return NextResponse.json(
        { error: "Not authorized to view this client." },
        { status: 403 },
      );
    }

    const [prefs] = await db
      .select({
        dietary: userPreferences.dietary,
        allergies: userPreferences.allergies,
        goals: userPreferences.goals,
        whyMealPrep: userPreferences.whyMealPrep,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, clientId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        dietary: prefs?.dietary ?? [],
        allergies: prefs?.allergies ?? [],
        goals: prefs?.goals ?? [],
        whyMealPrep: prefs?.whyMealPrep ?? [],
        hasPreferences: Boolean(prefs),
      },
    });
  } catch (err) {
    console.error("[business/clients/[clientId]/preferences]", err);
    return NextResponse.json(
      { error: "Failed to fetch client preferences." },
      { status: 500 },
    );
  }
}
