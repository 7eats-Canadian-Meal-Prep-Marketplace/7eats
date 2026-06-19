import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { uploadAvatar } from "@/lib/storage/avatars";
import { sniffFileType } from "@/lib/upload-validation";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "cook") return unauthorized();

  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const fd = await req.formData();
    const photo = fd.get("photo") as File | null;
    if (!photo || photo.size === 0) {
      return NextResponse.json(
        { error: "Photo is required." },
        { status: 400 },
      );
    }
    if (!["image/jpeg", "image/png"].includes(photo.type)) {
      return NextResponse.json(
        { error: "Photo must be JPEG or PNG." },
        { status: 400 },
      );
    }
    if (photo.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Photo must be smaller than 4 MB." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await photo.arrayBuffer());
    const sniffed = sniffFileType(buf);
    if (sniffed !== "image/jpeg" && sniffed !== "image/png") {
      return NextResponse.json(
        { error: "Photo must be a valid JPEG or PNG." },
        { status: 400 },
      );
    }

    const photoUrl = await uploadAvatar(
      session.user.id,
      photo.name,
      buf,
      sniffed,
    );

    const [updated] = await db
      .update(cookProfiles)
      .set({ photoUrl })
      .where(eq(cookProfiles.id, cookId))
      .returning({ photoUrl: cookProfiles.photoUrl });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[business/profile/photo]", err);
    return NextResponse.json(
      { error: "Failed to upload photo." },
      { status: 500 },
    );
  }
}
