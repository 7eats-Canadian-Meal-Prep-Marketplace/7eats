import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";

// Lightweight health check for uptime monitors. Pings the database so a DB
// outage surfaces as 503, not a silent 200.
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    console.error("[health] db check failed", err);
    return NextResponse.json(
      { status: "degraded", error: "database unreachable" },
      { status: 503 },
    );
  }
}
