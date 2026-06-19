import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  authUserTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/business/me/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/business/me", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/business/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "cook" },
    } as never);
  });

  it("updates first and last name", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: "user-1",
        firstName: "Cook",
        lastName: "User",
        phone: "+14165550123",
        phoneVerified: true,
      },
    ]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(makeReq({ firstName: "Cook", lastName: "User" }));

    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Cook",
        lastName: "User",
      }),
    );
  });

  it("rejects direct phone updates", async () => {
    const res = await PATCH(makeReq({ phone: "+14165550999" }));

    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });
});
