import { beforeEach, describe, expect, it, vi } from "vitest";

// biome-ignore lint: mock constructor must be callable with new
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn((args: unknown) => ({ input: args })),
  GetObjectCommand: vi.fn((args: unknown) => ({ input: args })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("@/lib/storage/client", () => ({
  r2Client: { send: vi.fn() },
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSignedCertUrl, uploadCert } from "@/lib/storage/certs";
import { r2Client } from "@/lib/storage/client";

describe("certs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadCert", () => {
    it("sends a PutObjectCommand to the certs bucket and returns a key", async () => {
      vi.mocked(r2Client.send).mockResolvedValue({} as never);

      const key = await uploadCert(
        "cook-123",
        "cert.pdf",
        Buffer.from("data"),
        "application/pdf",
      );

      expect(r2Client.send).toHaveBeenCalledOnce();
      const [command] = vi.mocked(r2Client.send).mock.calls[0];
      expect((command as { input: { Bucket: string } }).input.Bucket).toBe(
        "homecook-certs-private",
      );
      expect(key).toMatch(/^certs\/cook-123\//);
      expect(key).toContain("cert.pdf");
    });
  });

  describe("getSignedCertUrl", () => {
    it("returns a signed URL with the default 900s expiry", async () => {
      vi.mocked(getSignedUrl).mockResolvedValue("https://signed.example.com");

      const url = await getSignedCertUrl("certs/cook-123/cert.pdf");

      expect(getSignedUrl).toHaveBeenCalledWith(
        r2Client,
        expect.objectContaining({
          input: {
            Bucket: "homecook-certs-private",
            Key: "certs/cook-123/cert.pdf",
          },
        }),
        { expiresIn: 900 },
      );
      expect(url).toBe("https://signed.example.com");
    });

    it("clamps expiresIn to 3600s when a larger value is passed", async () => {
      vi.mocked(getSignedUrl).mockResolvedValue("https://signed.example.com");

      await getSignedCertUrl("certs/cook-123/cert.pdf", 9999);

      expect(getSignedUrl).toHaveBeenCalledWith(r2Client, expect.anything(), {
        expiresIn: 3600,
      });
    });

    it("passes a custom expiresIn when within the 3600s limit", async () => {
      vi.mocked(getSignedUrl).mockResolvedValue("https://signed.example.com");

      await getSignedCertUrl("certs/cook-123/cert.pdf", 1800);

      expect(getSignedUrl).toHaveBeenCalledWith(r2Client, expect.anything(), {
        expiresIn: 1800,
      });
    });
  });
});
