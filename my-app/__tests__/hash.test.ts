import { describe, expect, it } from "vitest";
import { hashIp } from "@/lib/hash";

describe("hashIp", () => {
  it("returns a 64-character lowercase hex string", () => {
    const result = hashIp("192.168.1.1");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("is deterministic — same input always produces same hash", () => {
    expect(hashIp("192.168.1.1")).toBe(hashIp("192.168.1.1"));
  });

  it("produces different hashes for different IPs", () => {
    expect(hashIp("192.168.1.1")).not.toBe(hashIp("10.0.0.1"));
  });
});
