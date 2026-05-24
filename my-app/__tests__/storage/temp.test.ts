import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(
    // @ts-expect-error: constructor mock requires function declaration, not arrow function
    function mockPutObjectCommand(args: unknown) {
      this.input = args;
    },
  ),
  CopyObjectCommand: vi.fn(
    // @ts-expect-error: constructor mock requires function declaration, not arrow function
    function mockCopyObjectCommand(args: unknown) {
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
    TEMP: "homecook-uploads-temp",
  },
}));

import { r2Client } from "@/lib/storage/client";
import { deleteTemp, moveFromTemp, uploadToTemp } from "@/lib/storage/temp";

describe("temp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadToTemp", () => {
    it("sends a PutObjectCommand to the temp bucket", async () => {
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      await uploadToTemp(
        "pending/cook-123/cert.pdf",
        Buffer.from("data"),
        "application/pdf",
      );

      expect(r2Client.send).toHaveBeenCalledOnce();
      const [command] = vi.mocked(r2Client.send).mock.calls[0];
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Bucket,
      ).toBe("homecook-uploads-temp");
      expect(
        (command as { input: { Bucket: string; Key: string } }).input.Key,
      ).toBe("pending/cook-123/cert.pdf");
    });
  });

  describe("moveFromTemp", () => {
    it("copies to the destination then deletes from temp — in that order", async () => {
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      await moveFromTemp(
        "pending/cook-123/cert.pdf",
        "homecook-certs-private",
        "certs/cook-123/cert.pdf",
      );

      expect(r2Client.send).toHaveBeenCalledTimes(2);

      const [copyCall, deleteCall] = vi.mocked(r2Client.send).mock.calls;

      expect(
        (
          copyCall[0] as {
            input: { Bucket: string; CopySource: string; Key: string };
          }
        ).input,
      ).toEqual({
        Bucket: "homecook-certs-private",
        CopySource: "homecook-uploads-temp/pending/cook-123/cert.pdf",
        Key: "certs/cook-123/cert.pdf",
      });

      expect(
        (deleteCall[0] as { input: { Bucket: string; Key: string } }).input,
      ).toEqual({
        Bucket: "homecook-uploads-temp",
        Key: "pending/cook-123/cert.pdf",
      });
    });
  });

  describe("deleteTemp", () => {
    it("sends a DeleteObjectCommand to the temp bucket", async () => {
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      await deleteTemp("pending/cook-123/cert.pdf");

      expect(r2Client.send).toHaveBeenCalledOnce();
      const [command] = vi.mocked(r2Client.send).mock.calls[0];
      expect(
        (command as { input: { Bucket: string; Key: string } }).input,
      ).toEqual({
        Bucket: "homecook-uploads-temp",
        Key: "pending/cook-123/cert.pdf",
      });
    });
  });
});
