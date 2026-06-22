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

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));

import { POST } from "@/app/api/checkout/setup-intent/verify/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

const USER_ID = "user-uuid-1234";
const CLIENT_SECRET = "seti_abc_secret_xyz";

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

describe("POST /api/checkout/setup-intent/verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await POST(
      new Request("http://localhost/api/checkout/setup-intent/verify", {
        method: "POST",
        body: JSON.stringify({ clientSecret: CLIENT_SECRET }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns succeeded when the setup intent belongs to the customer", async () => {
    mockSession(USER_ID);
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ stripeCustomerId: "cus_123" }]),
    );
    vi.mocked(getStripe).mockReturnValue({
      setupIntents: {
        retrieve: vi.fn().mockResolvedValue({
          status: "succeeded",
          customer: "cus_123",
        }),
      },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/checkout/setup-intent/verify", {
        method: "POST",
        body: JSON.stringify({ clientSecret: CLIENT_SECRET }),
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.succeeded).toBe(true);
  });
});
