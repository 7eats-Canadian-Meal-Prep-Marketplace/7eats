import { beforeEach, describe, expect, it, vi } from "vitest";

const s3ClientConstructor = vi.hoisted(() =>
  vi.fn(function MockS3Client() {
    return {};
  }),
);

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: s3ClientConstructor,
}));

const ALL_ENV_VARS: Record<string, string> = {
  R2_ACCOUNT_ID: "test-account-id",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_PUBLIC_BUCKET_URL_LISTINGS: "https://listings.example.com",
  R2_PUBLIC_BUCKET_URL_AVATARS: "https://avatars.example.com",
};

describe("r2Client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns an S3Client when all env vars are present", async () => {
    for (const [key, val] of Object.entries(ALL_ENV_VARS)) {
      vi.stubEnv(key, val);
    }
    const { getR2Client } = await import("@/lib/storage/client");
    expect(getR2Client()).toBeDefined();
  });

  it.each(Object.keys(ALL_ENV_VARS))(
    "throws naming the missing variable when %s is absent",
    async (missingVar) => {
      for (const [key, val] of Object.entries(ALL_ENV_VARS)) {
        if (key !== missingVar) vi.stubEnv(key, val);
      }
      const { getR2Client } = await import("@/lib/storage/client");
      expect(() => getR2Client()).toThrow(missingVar);
    },
  );
});
