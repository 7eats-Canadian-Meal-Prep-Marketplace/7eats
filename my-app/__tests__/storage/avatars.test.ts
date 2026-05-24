import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(
    // @ts-expect-error: constructor mock requires function declaration, not arrow function
    function mockPutObjectCommand(args: unknown) {
      this.input = args;
    },
  ),
  DeleteObjectCommand: vi.fn(
    // @ts-expect-error: constructor mock requires function declaration, not arrow function
    function mockDeleteObjectCommand(args: unknown) {
      this.input = args;
    },
  ),
}));

vi.mock("@/lib/storage/client", () => ({
  r2Client: { send: vi.fn() },
}));

vi.mock("@/lib/storage/buckets", () => ({
  BUCKETS: {
    AVATARS: "homecook-avatars-public",
  },
  BUCKET_CONFIG: {
    "homecook-avatars-public": {
      access: "public",
      cdnBaseUrl: "https://avatars.example.com",
    },
  },
}));

import {
  deleteAvatar,
  getAvatarUrl,
  uploadAvatar,
} from "@/lib/storage/avatars";
import { r2Client } from "@/lib/storage/client";

describe("avatars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadAvatar", () => {
    it("sends a PutObjectCommand to the avatars bucket and returns a CDN URL", async () => {
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      const url = await uploadAvatar(
        "user-789",
        "avatar.png",
        Buffer.from("img"),
        "image/png",
      );

      expect(r2Client.send).toHaveBeenCalledOnce();
      const [command] = vi.mocked(r2Client.send).mock.calls[0];
      expect((command as { input: { Bucket: string } }).input.Bucket).toBe(
        "homecook-avatars-public",
      );
      expect(url).toMatch(/^https:\/\/avatars\.example\.com\//);
      const key = url.replace("https://avatars.example.com/", "");
      expect(key).toMatch(/^avatars\/user-789\//);
    });
  });

  describe("getAvatarUrl", () => {
    it("constructs the CDN URL without making an API call", () => {
      const url = getAvatarUrl("avatars/user-789/avatar.png");

      expect(r2Client.send).not.toHaveBeenCalled();
      expect(url).toBe(
        "https://avatars.example.com/avatars/user-789/avatar.png",
      );
    });
  });

  describe("deleteAvatar", () => {
    it("sends a DeleteObjectCommand to the avatars bucket", async () => {
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      await deleteAvatar("avatars/user-789/avatar.png");

      expect(r2Client.send).toHaveBeenCalledOnce();
      const [command] = vi.mocked(r2Client.send).mock.calls[0];
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Bucket,
      ).toBe("homecook-avatars-public");
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Key,
      ).toBe("avatars/user-789/avatar.png");
    });
  });
});
