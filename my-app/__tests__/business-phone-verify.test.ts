import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verificationChecksCreate } = vi.hoisted(() => ({
  verificationChecksCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { update: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  authUser: { id: "id", phone: "phone", phoneVerified: "pv" },
  authUserTable: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/cookie", () => ({ verifySignedPhone: vi.fn() }));
vi.mock("@/lib/phone-availability", () => ({
  isPhoneTakenForRole: vi.fn(),
  isUniqueViolation: vi.fn(() => false),
  phoneTakenMessage: (role: string) =>
    `This phone number is already in use by another ${role} account.`,
}));
vi.mock("@/lib/rate-limit", () => ({ logAndCheckRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    verify: {
      v2: {
        services: vi.fn(() => ({
          verificationChecks: { create: verificationChecksCreate },
        })),
      },
    },
  })),
}));

import { cookies } from "next/headers";
import { POST } from "@/app/api/business/phone/verify-otp/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { verifySignedPhone } from "@/lib/cookie";
import {
  isPhoneTakenForRole,
  isUniqueViolation,
} from "@/lib/phone-availability";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

const USER_ID = "user-uuid";

function mockSession(id: string | null, role = "cook") {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    id ? ({ user: { id, role } } as never) : null,
  );
}

function mockCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn(() => (value ? { value } : undefined)),
  } as never);
}

function mockUpdate(returnRows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returnRows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set, returning };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/business/phone/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "token_test");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_test");
  vi.mocked(logAndCheckRateLimit).mockResolvedValue(true);
  vi.mocked(isPhoneTakenForRole).mockResolvedValue(false);
  vi.mocked(isUniqueViolation).mockReturnValue(false);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/business/phone/verify-otp", () => {
  it("checks uniqueness against the session role and saves on success", async () => {
    mockSession(USER_ID, "cook");
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockResolvedValue({ status: "approved" });
    const { set } = mockUpdate([
      { phone: "+14165550123", phoneVerified: true },
    ]);

    const res = await POST(makeRequest({ code: "123456" }));

    expect(res.status).toBe(200);
    expect(vi.mocked(isPhoneTakenForRole)).toHaveBeenCalledWith(
      "+14165550123",
      "cook",
      USER_ID,
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+14165550123", phoneVerified: true }),
    );
  });

  it("returns 409 when the phone is already verified on another account of that role", async () => {
    mockSession(USER_ID, "cook");
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockResolvedValue({ status: "approved" });
    vi.mocked(isPhoneTakenForRole).mockResolvedValue(true);

    const res = await POST(makeRequest({ code: "123456" }));

    expect(res.status).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 409 when the unique index rejects the write (race)", async () => {
    mockSession(USER_ID, "cook");
    mockCookie("signed");
    vi.mocked(verifySignedPhone).mockReturnValue("+14165550123");
    verificationChecksCreate.mockResolvedValue({ status: "approved" });
    vi.mocked(isUniqueViolation).mockReturnValue(true);
    const returning = vi.fn().mockRejectedValue({ code: "23505" });
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await POST(makeRequest({ code: "123456" }));

    expect(res.status).toBe(409);
  });
});
