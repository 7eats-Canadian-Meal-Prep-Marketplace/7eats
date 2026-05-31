import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function getCookId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  if (session.user.role !== "cook") return null;

  const [cook] = await db
    .select({ id: cookProfiles.id })
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, session.user.id))
    .limit(1);

  return cook?.id ?? null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Not authenticated." }, { status: 401 });

export const notFound = (entity: string) =>
  NextResponse.json({ error: `${entity} not found.` }, { status: 404 });
