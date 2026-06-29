import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

beforeAll(() => {
  process.env.COOKIE_SECRET = "test-cookie-secret-guest-order-gate";
});

const { resolveGuestClientMock } = vi.hoisted(() => ({
  resolveGuestClientMock: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({ orders: {} }));
vi.mock("@/lib/guest/client", () => ({
  resolveGuestClient: resolveGuestClientMock,
  ensureStripeCustomer: vi.fn().mockResolvedValue("cus_test"),
}));
vi.mock("@/lib/guest/order-access", () => ({
  generateConfirmationCode: vi.fn(() => "7E-AAAA"),
  generateGuestAccessToken: vi.fn(() => "tok"),
  hashGuestAccessToken: vi.fn(() => "hash"),
}));
vi.mock("@/lib/orders/guest-order-lookup", () => ({
  getGuestOrderByToken: vi.fn(),
}));
vi.mock("@/lib/orders/place-order", () => ({
  createOrderBodySchema: z
    .object({ cookId: z.string(), dishes: z.array(z.any()) })
    .passthrough(),
  placeClientOrder: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST as placeGuestOrder } from "@/app/api/orders/guest/route";
import {
  buildVerifiedEmailCookie,
  GUEST_EMAIL_VERIFIED_COOKIE,
} from "@/lib/guest/email-otp";

const EMAIL = "guest@example.com";

const ORDER_BODY = {
  cookId: "cook-1",
  dishes: [{ dishId: "d1", quantity: 1 }],
  firstName: "Sam",
  lastName: "Lee",
  email: EMAIL,
  phone: "4165550100",
  acceptedTerms: true,
};

function post(cookie?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (cookie) headers.cookie = cookie;
  return new NextRequest("http://localhost/api/orders/guest", {
    method: "POST",
    body: JSON.stringify(ORDER_BODY),
    headers,
  });
}

beforeEach(() => {
  resolveGuestClientMock.mockReset();
});

describe("POST /api/orders/guest — email verification gate", () => {
  it("rejects (403) when the email isn't verified, before resolving the guest", async () => {
    const res = await placeGuestOrder(post());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.needsEmailVerification).toBe(true);
    expect(resolveGuestClientMock).not.toHaveBeenCalled();
  });

  it("rejects a verified cookie issued for a different email", async () => {
    const cookie = `${GUEST_EMAIL_VERIFIED_COOKIE}=${buildVerifiedEmailCookie("someone@else.com")}`;
    const res = await placeGuestOrder(post(cookie));
    expect(res.status).toBe(403);
    expect(resolveGuestClientMock).not.toHaveBeenCalled();
  });

  it("passes the gate when the email is verified", async () => {
    // resolveGuestClient short-circuits to needsLogin so we don't touch the DB —
    // reaching it proves the gate let the request through.
    resolveGuestClientMock.mockResolvedValue({
      needsLogin: true,
      email: EMAIL,
    });
    const cookie = `${GUEST_EMAIL_VERIFIED_COOKIE}=${buildVerifiedEmailCookie(EMAIL)}`;
    const res = await placeGuestOrder(post(cookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.needsLogin).toBe(true);
    expect(resolveGuestClientMock).toHaveBeenCalledOnce();
  });
});
