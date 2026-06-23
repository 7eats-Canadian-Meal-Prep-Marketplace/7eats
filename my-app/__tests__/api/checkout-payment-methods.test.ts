import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
}));

vi.mock("@/lib/payment-methods", () => ({
  detachCustomerPaymentMethod: vi.fn(),
}));

import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/checkout/payment-methods/[pmId]/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { detachCustomerPaymentMethod } from "@/lib/payment-methods";

const USER_ID = "user-uuid-1234";
const PM_ID = "pm_1234567890";

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId
      ? ({ user: { id: userId, role: "client" } } as never)
      : (null as never),
  );
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

describe("DELETE /api/checkout/payment-methods/[pmId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await DELETE(
      new NextRequest(`http://localhost/api/checkout/payment-methods/${PM_ID}`),
      { params: Promise.resolve({ pmId: PM_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payment method ids", async () => {
    mockSession(USER_ID);
    const res = await DELETE(
      new NextRequest("http://localhost/api/checkout/payment-methods/bad-id"),
      { params: Promise.resolve({ pmId: "bad-id" }) },
    );
    expect(res.status).toBe(400);
  });

  it("detaches a saved card for the authenticated customer", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ stripeCustomerId: "cus_123" }]),
    );

    const res = await DELETE(
      new NextRequest(`http://localhost/api/checkout/payment-methods/${PM_ID}`),
      { params: Promise.resolve({ pmId: PM_ID }) },
    );

    expect(res.status).toBe(200);
    expect(detachCustomerPaymentMethod).toHaveBeenCalledWith("cus_123", PM_ID);
  });
});
