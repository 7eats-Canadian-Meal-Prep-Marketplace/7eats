import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocoding";

const schema = z.object({
  address: z.string().min(5).max(300),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Address is required." },
      { status: 400 },
    );
  }

  try {
    const point = await geocodeAddress(parsed.data.address);
    if (!point) {
      return NextResponse.json(
        { error: "Address not found. Please try a more specific address." },
        { status: 422 },
      );
    }
    return NextResponse.json({ data: point });
  } catch (err) {
    console.error("[geocode]", err);
    return NextResponse.json(
      { error: "Could not geocode address." },
      { status: 500 },
    );
  }
}
