import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  // eslint-disable-next-line
  PutObjectCommand: vi.fn(
    // @ts-expect-error - Function declaration needed for constructor usage
    function mockPutObjectCommand(args: unknown) {
      this.input = args;
    },
  ),
  // eslint-disable-next-line
  DeleteObjectCommand: vi.fn(
    // @ts-expect-error - Function declaration needed for constructor usage
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
    LISTINGS: "homecook-listings-public",
  },
  BUCKET_CONFIG: {
    "homecook-listings-public": {
      access: "public",
      cdnBaseUrl: "https://listings.example.com",
    },
  },
}));

import { r2Client } from "@/lib/storage/client";
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
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      const url = await uploadListingPhoto(
        "listing-456",
        "photo.jpg",
        Buffer.from("img"),
        "image/jpeg",
      );

      expect(r2Client.send).toHaveBeenCalledOnce();
      const [command] = vi.mocked(r2Client.send).mock.calls[0];
      expect((command as { input: { Bucket: string } }).input.Bucket).toBe(
        "homecook-listings-public",
      );
      expect(url).toMatch(/^https:\/\/listings\.example\.com\//);
    });
  });

  describe("getListingPhotoUrl", () => {
    it("constructs the CDN URL without making an API call", () => {
      const url = getListingPhotoUrl("listings/listing-456/photo.jpg");

      expect(r2Client.send).not.toHaveBeenCalled();
      expect(url).toBe(
        "https://listings.example.com/listings/listing-456/photo.jpg",
      );
    });
  });

  describe("deleteListingPhoto", () => {
    it("sends a DeleteObjectCommand to the listings bucket", async () => {
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      await deleteListingPhoto("listings/listing-456/photo.jpg");

      expect(r2Client.send).toHaveBeenCalledOnce();
      const [command] = vi.mocked(r2Client.send).mock.calls[0];
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Bucket,
      ).toBe("homecook-listings-public");
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Key,
      ).toBe("listings/listing-456/photo.jpg");
    });
  });
});
