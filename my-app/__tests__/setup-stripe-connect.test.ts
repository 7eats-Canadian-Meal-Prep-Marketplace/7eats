import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  cookProfiles: {
    id: "id",
    userId: "userId",
    displayName: "displayName",
    stripeAccountId: "stripeAccountId",
  },
}));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { POST } from "@/app/api/setup/stripe-connect/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/setup/stripe-connect", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  });
}

function mockSession(role: string, id = "user_abcdefgh") {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id, role, email: "cook@example.com" },
  } as never);
}

function mockStripeCreate(account: { id: string }) {
  const create = vi.fn().mockResolvedValue(account);
  vi.mocked(getStripe).mockReturnValue({
    v2: { core: { accounts: { create } } },
  } as never);
  return create;
}

let whereSpy: ReturnType<typeof vi.fn>;
let setSpy: ReturnType<typeof vi.fn>;
let limitSpy: ReturnType<typeof vi.fn>;
let whereSelectSpy: ReturnType<typeof vi.fn>;
let fromSpy: ReturnType<typeof vi.fn>;

describe("POST /api/setup/stripe-connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock db.select() chain for checking existing account
    whereSelectSpy = vi.fn().mockResolvedValue([]);
    limitSpy = vi.fn().mockResolvedValue([]);
    fromSpy = vi.fn(() => ({ where: whereSelectSpy }));
    whereSelectSpy.mockReturnValue({ limit: limitSpy });
    vi.mocked(db.select).mockReturnValue({ from: fromSpy } as never);
    limitSpy.mockResolvedValue([
      { id: "cook_profile_1", displayName: "Maria's Kitchen" },
    ]);

    // Mock db.update() chain for storing stripe account
    whereSpy = vi.fn().mockResolvedValue(undefined);
    setSpy = vi.fn(() => ({ where: whereSpy }));
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as never);
  });

  it("returns 200 with success:true for a cook session when creating new account", async () => {
    mockSession("cook");
    mockStripeCreate({ id: "acct_test123" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user has the client role", async () => {
    mockSession("client");

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when the user has the admin role", async () => {
    mockSession("admin");

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("writes the stripe account ID returned from Stripe API", async () => {
    const userId = "user_abcdefghijkl";
    const mockAccountId = "acct_stripe123";
    mockSession("cook", userId);
    const create = mockStripeCreate({ id: mockAccountId });
    limitSpy.mockResolvedValue([
      { id: "cook_profile_1", displayName: "Maria's Kitchen" },
    ]);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.7eats.ca");

    await POST(makeRequest());

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        defaults: expect.objectContaining({
          profile: {
            business_url: "https://www.7eats.ca/app/cooks/cook_profile_1",
            doing_business_as: "Maria's Kitchen",
            product_description:
              "Maria's Kitchen sells homemade meals on 7eats.",
          },
        }),
      }),
    );
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeAccountId: mockAccountId,
      }),
    );
  });

  it("returns 200 with success:true if account already exists", async () => {
    mockSession("cook");
    const existingAccountId = "acct_existing";
    limitSpy.mockResolvedValue([
      {
        id: "cook_profile_1",
        displayName: "Maria's Kitchen",
        stripeAccountId: existingAccountId,
      },
    ]);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Should NOT call Stripe API if account already exists
    expect(getStripe).not.toHaveBeenCalled();
  });
});
