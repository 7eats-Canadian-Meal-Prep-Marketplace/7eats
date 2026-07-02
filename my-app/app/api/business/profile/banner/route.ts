import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { uploadBanner } from "@/lib/storage/avatars";
import { sniffFileType } from "@/lib/upload-validation";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "cook") return unauthorized();

  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    const fd = await req.formData();
    const banner = fd.get("banner") as File | null;
    if (!banner || banner.size === 0) {
      return NextResponse.json(
        { error: "Banner is required." },
        { status: 400 },
      );
    }
    if (!["image/jpeg", "image/png"].includes(banner.type)) {
      return NextResponse.json(
        { error: "Banner must be JPEG or PNG." },
        { status: 400 },
      );
    }
    if (banner.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Banner must be smaller than 8 MB." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await banner.arrayBuffer());
    const sniffed = sniffFileType(buf);
    if (sniffed !== "image/jpeg" && sniffed !== "image/png") {
      return NextResponse.json(
        { error: "Banner must be a valid JPEG or PNG." },
        { status: 400 },
      );
    }

    const bannerUrl = await uploadBanner(
      session.user.id,
      banner.name,
      buf,
      sniffed,
    );

    const [updated] = await db
      .update(cookProfiles)
      .set({ bannerUrl })
      .where(eq(cookProfiles.id, cookId))
      .returning({ bannerUrl: cookProfiles.bannerUrl });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[business/profile/banner]", err);
    return NextResponse.json(
      { error: "Failed to upload banner." },
      { status: 500 },
    );
  }
}
