import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authUser, authUserTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  avatarKeyFromUrl,
  deleteAvatar,
  uploadAvatar,
} from "@/lib/storage/avatars";
import { sniffFileType } from "@/lib/upload-validation";

const MAX_BYTES = 4 * 1024 * 1024;

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "client") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ image: authUser.image })
      .from(authUser)
      .where(eq(authUser.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (!user.image) {
      return NextResponse.json({ success: true, data: { image: null } });
    }

    const key = avatarKeyFromUrl(user.image);
    if (key) {
      try {
        await deleteAvatar(key);
      } catch (err) {
        console.error("[user/profile/photo/DELETE] storage", err);
      }
    }

    const [updated] = await db
      .update(authUserTable)
      .set({ image: null, updatedAt: new Date() })
      .where(eq(authUser.id, session.user.id))
      .returning({ image: authUser.image });

    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[user/profile/photo/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to remove photo." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "client") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

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
    if (photo.size > MAX_BYTES) {
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

    const image = await uploadAvatar(session.user.id, photo.name, buf, sniffed);

    const [updated] = await db
      .update(authUserTable)
      .set({ image, updatedAt: new Date() })
      .where(eq(authUser.id, session.user.id))
      .returning({ image: authUser.image });

    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[user/profile/photo]", err);
    return NextResponse.json(
      { error: "Failed to upload photo." },
      { status: 500 },
    );
  }
}
