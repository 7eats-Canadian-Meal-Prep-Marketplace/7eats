import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { uploadListingPhoto } from "@/lib/storage/listings";
import { sniffFileType } from "@/lib/upload-validation";

type Params = { params: Promise<{ listingId: string }> };

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

// Accepts a multipart upload, stores the image in the listings R2 bucket, and
// persists the resulting CDN URL to the listing's coverPhotoUrl. Returns the URL
// so the client can show it immediately.
export async function POST(req: Request, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { listingId } = await params;

  // Verify the listing belongs to this cook before touching storage.
  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)))
    .limit(1);
  if (!listing) return notFound("Listing");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid upload. Expected multipart form data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: "Cover photo must be a JPEG, PNG, or WEBP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Cover photo must be smaller than 5 MB." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffFileType(buf);
  if (
    sniffed !== "image/jpeg" &&
    sniffed !== "image/png" &&
    sniffed !== "image/webp"
  ) {
    return NextResponse.json(
      { error: "File is not a valid JPEG, PNG, or WEBP image." },
      { status: 400 },
    );
  }

  let url: string;
  try {
    url = await uploadListingPhoto(listingId, file.name, buf, sniffed);
  } catch (err) {
    console.error("[listings/cover] upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }

  try {
    await db
      .update(listings)
      .set({ coverPhotoUrl: url })
      .where(and(eq(listings.id, listingId), eq(listings.cookId, cookId)));
  } catch (err) {
    console.error("[listings/cover] db update failed:", err);
    return NextResponse.json(
      { error: "Could not save the cover photo. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { coverPhotoUrl: url } });
}
