import {
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { BUCKETS, type TempDestBucket } from "@/lib/storage/buckets";
import { r2Client } from "@/lib/storage/client";

export async function uploadToTemp(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKETS.TEMP,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Not atomic: if the delete fails after a successful copy, the object exists in
// both buckets. On retry, the copy is idempotent. Callers should call deleteTemp
// explicitly if they detect the delete step failed.
export async function moveFromTemp(
  key: string,
  destBucket: TempDestBucket,
  destKey: string,
): Promise<void> {
  await r2Client.send(
    new CopyObjectCommand({
      Bucket: destBucket,
      CopySource: `${BUCKETS.TEMP}/${key}`,
      Key: destKey,
    }),
  );
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: BUCKETS.TEMP, Key: key }),
  );
}

export async function deleteTemp(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: BUCKETS.TEMP, Key: key }),
  );
}
