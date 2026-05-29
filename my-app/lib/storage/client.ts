import { S3Client } from "@aws-sdk/client-s3";

const REQUIRED_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BUCKET_URL_LISTINGS",
  "R2_PUBLIC_BUCKET_URL_AVATARS",
] as const;

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });

  return _r2Client;
}
