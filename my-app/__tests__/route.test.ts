import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hash", () => ({ hashIp: vi.fn(() => "hashed-ip") }));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("@/lib/waitlist", () => ({ addToWaitlist: vi.fn() }));

import { logAndCheckRateLimit } from "@/lib/rate-limit";
import { addToWaitlist } from "@/lib/waitlist";
import { POST } from "@/app/api/waitlist/route";

function makeRequest(
  body: unknown,
  overrideHeaders: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/waitlist", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
      ...overrideHeaders,
    },
  });
}

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
    vi.mocked(addToWaitlist).mockResolvedValue(undefined);
  });

  it("returns 200 and calls addToWaitlist for a valid signup", async () => {
    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, message: "You're on the list!" });
    expect(vi.mocked(addToWaitlist)).toHaveBeenCalledWith(
      "user@example.com",
      "hashed-ip",
    );
  });

  it("returns 200 for a duplicate email (idempotent)", async () => {
    const res = await POST(makeRequest({ email: "existing@example.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body).toEqual({
      success: false,
      message: "Too many attempts. Try again later.",
    });
  });

  it("returns 400 for wrong content-type", async () => {
    const res = await POST(
      makeRequest(
        { email: "user@example.com" },
        { "content-type": "text/plain" },
      ),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it("returns 400 for a bot user-agent", async () => {
    const res = await POST(
      makeRequest(
        { email: "user@example.com" },
        { "user-agent": "python-requests/2.31.0" },
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an oversized body", async () => {
    const req = new NextRequest("http://localhost/api/waitlist", {
      method: "POST",
      body: "x".repeat(2000),
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-valid" }));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it("returns 500 and does not leak error details on unexpected error", async () => {
    vi.mocked(logAndCheckRateLimit).mockRejectedValue(
      new Error("DB connection failed"),
    );

    const res = await POST(makeRequest({ email: "user@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, message: "Something went wrong." });
  });
});
