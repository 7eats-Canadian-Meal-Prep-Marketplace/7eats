import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { guardRequest, waitlistSchema } from "@/lib/validation";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/waitlist", {
    method: "POST",
    headers,
  });
}

describe("waitlistSchema", () => {
  it("accepts a valid email", () => {
    expect(
      waitlistSchema.safeParse({ email: "user@example.com" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email format", () => {
    expect(waitlistSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("rejects a missing email field", () => {
    expect(waitlistSchema.safeParse({}).success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    expect(
      waitlistSchema.safeParse({ email: "user@example.com", role: "cook" })
        .success,
    ).toBe(false);
  });
});

describe("guardRequest", () => {
  it("returns null for a valid request", () => {
    const req = makeRequest({
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    });
    expect(guardRequest(req)).toBeNull();
  });

  it("rejects wrong content-type", () => {
    const req = makeRequest({
      "content-type": "text/plain",
      "user-agent": "Mozilla/5.0",
    });
    expect(guardRequest(req)).toBe("Invalid request.");
  });

  it("rejects a missing user-agent", () => {
    const req = makeRequest({ "content-type": "application/json" });
    expect(guardRequest(req)).toBe("Invalid request.");
  });

  it("rejects curl user-agent", () => {
    const req = makeRequest({
      "content-type": "application/json",
      "user-agent": "curl/7.88.1",
    });
    expect(guardRequest(req)).toBe("Invalid request.");
  });

  it("rejects python-requests user-agent", () => {
    const req = makeRequest({
      "content-type": "application/json",
      "user-agent": "python-requests/2.31.0",
    });
    expect(guardRequest(req)).toBe("Invalid request.");
  });
});
