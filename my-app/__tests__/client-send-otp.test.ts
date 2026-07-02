import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verificationsCreate } = vi.hoisted(() => ({
  verificationsCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/cookie", () => ({
  generateSignedPhone: vi.fn(() => "signed-phone"),
}));
vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn(),
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    verify: {
      v2: {
        services: vi.fn(() => ({
          verifications: { create: verificationsCreate },
        })),
      },
    },
  })),
}));

import { POST } from "@/app/api/auth/client/send-otp/route";
import { auth } from "@/lib/auth";
import { generateSignedPhone } from "@/lib/cookie";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/client/send-otp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "client" } } as never) : null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "token_test");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_test");
  vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/client/send-otp", () => {
  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await POST(makeRequest({ phone: "4165550123" }));
    expect(res.status).toBe(401);
    expect(verificationsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid phone number", async () => {
    mockSession("user-1");
    const res = await POST(makeRequest({ phone: "123" }));
    expect(res.status).toBe(400);
    expect(logAndCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockSession("user-1");
    vi.mocked(logAndCheckRateLimit).mockResolvedValue(false);
    const res = await POST(makeRequest({ phone: "4165550123" }));
    expect(res.status).toBe(429);
    expect(verificationsCreate).not.toHaveBeenCalled();
  });

  it("returns 500 when Twilio fails", async () => {
    mockSession("user-1");
    verificationsCreate.mockRejectedValue(new Error("twilio down"));
    const res = await POST(makeRequest({ phone: "4165550123" }));
    expect(res.status).toBe(500);
  });

  it("normalises to E.164, sends code, sets pending_phone cookie", async () => {
    mockSession("user-1");
    verificationsCreate.mockResolvedValue({ status: "pending" });

    const res = await POST(makeRequest({ phone: "(416) 555-0123" }));

    expect(res.status).toBe(200);
    expect(verificationsCreate).toHaveBeenCalledWith({
      to: "+14165550123",
      channel: "sms",
    });
    expect(generateSignedPhone).toHaveBeenCalledWith("+14165550123");
    expect(res.headers.get("set-cookie")).toContain("pending_phone=");
  });
});
