import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/db", () => ({ db: { update: vi.fn() } }));
vi.mock("@/db/schema", () => ({ cookProfiles: { userId: "userId" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { POST } from "@/app/api/setup/stripe-connect/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/setup/stripe-connect", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  });
}

function mockSession(role: string, id = "user_abcdefgh") {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id, role },
  } as never);
}

let whereSpy: ReturnType<typeof vi.fn>;
let setSpy: ReturnType<typeof vi.fn>;

describe("POST /api/setup/stripe-connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereSpy = vi.fn().mockResolvedValue(undefined);
    setSpy = vi.fn(() => ({ where: whereSpy }));
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as never);
  });

  it("returns 200 with success:true for a cook session in non-production", async () => {
    mockSession("cook");

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

  it("writes a mock_acct_ prefixed stripe ID derived from the cook's userId", async () => {
    const userId = "user_abcdefghijkl";
    mockSession("cook", userId);

    await POST(makeRequest());

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeAccountId: `mock_acct_${userId.slice(0, 8)}`,
      }),
    );
  });

  it("returns 501 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await POST(makeRequest());
    expect(res.status).toBe(501);

    vi.unstubAllEnvs();
  });
});
