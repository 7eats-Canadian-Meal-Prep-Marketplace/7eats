import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(function mockPutObjectCommand(
    this: { input: unknown },
    args: unknown,
  ) {
    this.input = args;
  }),
  DeleteObjectCommand: vi.fn(function mockDeleteObjectCommand(
    this: { input: unknown },
    args: unknown,
  ) {
    this.input = args;
  }),
}));

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@/lib/storage/client", () => ({
  getR2Client: () => ({ send: mockSend }),
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
  avatarKeyFromUrl,
  deleteAvatar,
  getAvatarUrl,
  uploadAvatar,
} from "@/lib/storage/avatars";

describe("avatars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadAvatar", () => {
    it("sends a PutObjectCommand to the avatars bucket and returns a CDN URL", async () => {
      vi.mocked(mockSend).mockResolvedValue({} as never);

      const url = await uploadAvatar(
        "user-789",
        "avatar.png",
        Buffer.from("img"),
        "image/png",
      );

      expect(mockSend).toHaveBeenCalledOnce();
      const [command] = vi.mocked(mockSend).mock.calls[0];
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

      expect(mockSend).not.toHaveBeenCalled();
      expect(url).toBe(
        "https://avatars.example.com/avatars/user-789/avatar.png",
      );
    });
  });

  describe("avatarKeyFromUrl", () => {
    it("extracts the storage key from a CDN URL", () => {
      expect(
        avatarKeyFromUrl(
          "https://avatars.example.com/avatars/user-789/avatar.png",
        ),
      ).toBe("avatars/user-789/avatar.png");
    });
  });

  describe("deleteAvatar", () => {
    it("sends a DeleteObjectCommand to the avatars bucket", async () => {
      vi.mocked(mockSend).mockResolvedValue({} as never);

      await deleteAvatar("avatars/user-789/avatar.png");

      expect(mockSend).toHaveBeenCalledOnce();
      const [command] = vi.mocked(mockSend).mock.calls[0];
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Bucket,
      ).toBe("homecook-avatars-public");
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Key,
      ).toBe("avatars/user-789/avatar.png");
    });
  });
});
