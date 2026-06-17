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
    LISTINGS: "homecook-listings-public",
  },
  BUCKET_CONFIG: {
    "homecook-listings-public": {
      access: "public",
      cdnBaseUrl: "https://listings.example.com",
    },
  },
}));

import {
  deleteListingPhoto,
  getListingPhotoUrl,
  uploadListingPhoto,
} from "@/lib/storage/listings";

describe("listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadListingPhoto", () => {
    it("sends a PutObjectCommand to the listings bucket and returns a CDN URL", async () => {
      vi.mocked(mockSend).mockResolvedValue({} as never);

      const url = await uploadListingPhoto(
        "listing-456",
        "photo.jpg",
        Buffer.from("img"),
        "image/jpeg",
      );

      expect(mockSend).toHaveBeenCalledOnce();
      const [command] = vi.mocked(mockSend).mock.calls[0];
      expect((command as { input: { Bucket: string } }).input.Bucket).toBe(
        "homecook-listings-public",
      );
      expect(url).toMatch(/^https:\/\/listings\.example\.com\//);
      const key = url.replace("https://listings.example.com/", "");
      expect(key).toMatch(/^listings\/listing-456\//);
    });
  });

  describe("getListingPhotoUrl", () => {
    it("constructs the CDN URL without making an API call", () => {
      const url = getListingPhotoUrl("listings/listing-456/photo.jpg");

      expect(mockSend).not.toHaveBeenCalled();
      expect(url).toBe(
        "https://listings.example.com/listings/listing-456/photo.jpg",
      );
    });

    it("does not double up the slash when the base has a trailing slash", async () => {
      const { BUCKET_CONFIG } = await import("@/lib/storage/buckets");
      const original = BUCKET_CONFIG["homecook-listings-public"].cdnBaseUrl;
      BUCKET_CONFIG["homecook-listings-public"].cdnBaseUrl =
        "https://listings.example.com/";
      try {
        const url = getListingPhotoUrl("listings/listing-456/photo.jpg");
        expect(url).toBe(
          "https://listings.example.com/listings/listing-456/photo.jpg",
        );
        expect(url).not.toContain(".com//");
      } finally {
        BUCKET_CONFIG["homecook-listings-public"].cdnBaseUrl = original;
      }
    });
  });

  describe("deleteListingPhoto", () => {
    it("sends a DeleteObjectCommand to the listings bucket", async () => {
      vi.mocked(mockSend).mockResolvedValue({} as never);

      await deleteListingPhoto("listings/listing-456/photo.jpg");

      expect(mockSend).toHaveBeenCalledOnce();
      const [command] = vi.mocked(mockSend).mock.calls[0];
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Bucket,
      ).toBe("homecook-listings-public");
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Key,
      ).toBe("listings/listing-456/photo.jpg");
    });
  });
});
