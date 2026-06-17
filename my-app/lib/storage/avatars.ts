import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET_CONFIG, BUCKETS } from "@/lib/storage/buckets";
import { getR2Client } from "@/lib/storage/client";

export async function uploadAvatar(
  userId: string,
  fileName: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const key = `avatars/${userId}/${Date.now()}-${fileName}`;
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: BUCKETS.AVATARS,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return getAvatarUrl(key);
}

export function getAvatarUrl(key: string): string {
  const base = BUCKET_CONFIG[BUCKETS.AVATARS].cdnBaseUrl;
  if (!base) throw new Error("R2_PUBLIC_BUCKET_URL_AVATARS is not configured");
  // Strip any trailing slash so a configured base like ".../" doesn't produce a
  // double slash, which R2 treats as a different (missing) object key → 404.
  return `${base.replace(/\/+$/, "")}/${key}`;
}

export async function deleteAvatar(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: BUCKETS.AVATARS, Key: key }),
  );
}
