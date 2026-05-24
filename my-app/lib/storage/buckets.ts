export const BUCKETS = {
  CERTS: "homecook-certs-private",
  LISTINGS: "homecook-listings-public",
  AVATARS: "homecook-avatars-public",
  TEMP: "homecook-uploads-temp",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export type TempDestBucket =
  | "homecook-certs-private"
  | "homecook-listings-public"
  | "homecook-avatars-public";

type BucketConfig = {
  access: "public" | "private";
  cdnBaseUrl?: string;
  signedUrlTtl?: number;
};

export const BUCKET_CONFIG: Record<BucketName, BucketConfig> = {
  [BUCKETS.CERTS]: { access: "private", signedUrlTtl: 900 },
  [BUCKETS.LISTINGS]: {
    access: "public",
    cdnBaseUrl: process.env.R2_PUBLIC_BUCKET_URL_LISTINGS,
  },
  [BUCKETS.AVATARS]: {
    access: "public",
    cdnBaseUrl: process.env.R2_PUBLIC_BUCKET_URL_AVATARS,
  },
  [BUCKETS.TEMP]: { access: "private" },
};
