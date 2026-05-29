import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(function mockPutObjectCommand(
    this: { input: unknown },
    args: unknown,
  ) {
    this.input = args;
  }),
  CopyObjectCommand: vi.fn(function mockCopyObjectCommand(
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
    TEMP: "homecook-uploads-temp",
  },
}));

import { deleteTemp, moveFromTemp, uploadToTemp } from "@/lib/storage/temp";

describe("temp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadToTemp", () => {
    it("sends a PutObjectCommand to the temp bucket", async () => {
      vi.mocked(mockSend).mockResolvedValue({} as never);

      await uploadToTemp(
        "pending/cook-123/cert.pdf",
        Buffer.from("data"),
        "application/pdf",
      );

      expect(mockSend).toHaveBeenCalledOnce();
      const [command] = vi.mocked(mockSend).mock.calls[0];
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
      vi.mocked(mockSend).mockResolvedValue({} as never);

      await moveFromTemp(
        "pending/cook-123/cert.pdf",
        "homecook-certs-private",
        "certs/cook-123/cert.pdf",
      );

      expect(mockSend).toHaveBeenCalledTimes(2);

      const [copyCall, deleteCall] = vi.mocked(mockSend).mock.calls;

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
      vi.mocked(mockSend).mockResolvedValue({} as never);

      await deleteTemp("pending/cook-123/cert.pdf");

      expect(mockSend).toHaveBeenCalledOnce();
      const [command] = vi.mocked(mockSend).mock.calls[0];
      expect(
        (command as { input: { Bucket: string; Key: string } }).input,
      ).toEqual({
        Bucket: "homecook-uploads-temp",
        Key: "pending/cook-123/cert.pdf",
      });
    });
  });
});
