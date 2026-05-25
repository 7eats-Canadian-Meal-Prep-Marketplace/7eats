import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BUCKETS } from "@/lib/storage/buckets";
import { r2Client } from "@/lib/storage/client";

export async function uploadCert(
  cookId: string,
  fileName: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const key = `certs/${cookId}/${Date.now()}-${fileName}`;
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKETS.CERTS,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function getSignedCertUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  const clampedExpiry = Math.min(expiresIn, 3600);
  return getSignedUrl(
    r2Client,
    new GetObjectCommand({ Bucket: BUCKETS.CERTS, Key: key }),
    { expiresIn: clampedExpiry },
  );
}
