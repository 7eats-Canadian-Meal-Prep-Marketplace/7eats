import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET_CONFIG, BUCKETS } from "@/lib/storage/buckets";
import { r2Client } from "@/lib/storage/client";

export async function uploadListingPhoto(
  listingId: string,
  fileName: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const key = `listings/${listingId}/${Date.now()}-${fileName}`;
  await r2Client.send(
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
  const base = BUCKET_CONFIG[BUCKETS.LISTINGS].cdnBaseUrl as string;
  return `${base}/${key}`;
}

export async function deleteListingPhoto(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: BUCKETS.LISTINGS, Key: key }),
  );
}
