import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET_CONFIG, BUCKETS } from "@/lib/storage/buckets";
import { getR2Client } from "@/lib/storage/client";

export async function uploadListingPhoto(
  listingId: string,
  fileName: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const key = `listings/${listingId}/${Date.now()}-${fileName}`;
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: BUCKETS.LISTINGS,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return getListingPhotoUrl(key);
}

export function getListingPhotoUrl(key: string): string {
  const base = BUCKET_CONFIG[BUCKETS.LISTINGS].cdnBaseUrl;
  if (!base) throw new Error("R2_PUBLIC_BUCKET_URL_LISTINGS is not configured");
  // Strip any trailing slash so a configured base like ".../" doesn't produce a
  // double slash, which R2 treats as a different (missing) object key → 404.
  return `${base.replace(/\/+$/, "")}/${key}`;
}

export function isListingPhotoUrl(url: string): boolean {
  const base = BUCKET_CONFIG[BUCKETS.LISTINGS].cdnBaseUrl;
  if (!base) return false;

  try {
    const normalizedBase = base.replace(/\/+$/, "");
    const parsedUrl = new URL(url);
    const parsedBase = new URL(normalizedBase);

    return (
      parsedUrl.origin === parsedBase.origin &&
      url.startsWith(`${normalizedBase}/listings/`)
    );
  } catch {
    return false;
  }
}

export async function deleteListingPhoto(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: BUCKETS.LISTINGS, Key: key }),
  );
}
