import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tags } from "@/db/schema";

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db
      .select({
        id: tags.id,
        slug: tags.slug,
        label: tags.label,
        category: tags.category,
      })
      .from(tags)
      .orderBy(asc(tags.category), asc(tags.label));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[tags] Unhandled error:", err);
    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 },
    );
  }
}
