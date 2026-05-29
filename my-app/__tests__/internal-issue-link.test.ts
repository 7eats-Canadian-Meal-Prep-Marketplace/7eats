import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/internal/_lib", () => ({
  verifyInternalKey: vi.fn(),
  hashToken: vi.fn(() => "token-hash-abc"),
  sendSetupEmail: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  cookApplications: { id: "id", status: "status" },
  setupTokens: { applicationId: "appId", tokenHash: "hash", id: "id" },
}));

import {
  hashToken,
  sendSetupEmail,
  verifyInternalKey,
} from "@/app/api/internal/_lib";
import { POST } from "@/app/api/internal/issue-link/route";
import { db, dbPool } from "@/db";

function makeRequest(body: unknown, key = "valid-key"): Request {
  return new Request("http://localhost/api/internal/issue-link", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-internal-key": key },
  });
}

type ApplicationRow = {
  id: string;
  status: string;
  contactEmail: string;
  kitchenName: string;
};

function setApplication(app: ApplicationRow | null) {
  const limit = vi.fn().mockResolvedValue(app ? [app] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

function makeTransactionMock() {
  vi.mocked(dbPool.transaction).mockImplementation(async (cb) => {
    const tx = {
      insert: vi
        .fn()
        .mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      delete: vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    };
    return cb(tx as never);
  });
}

const pendingApp: ApplicationRow = {
  id: "app-1",
  status: "pending_review",
  contactEmail: "chef@example.com",
  kitchenName: "The Great Kitchen",
};

describe("POST /api/internal/issue-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyInternalKey).mockImplementation(
      (key) => key === "valid-key",
    );
    vi.mocked(hashToken).mockReturnValue("token-hash-abc");
    vi.mocked(sendSetupEmail).mockResolvedValue(undefined);
    setApplication(pendingApp);
    makeTransactionMock();
  });

  it("returns 200 { ok: true } for a valid key and a pending_review application", async () => {
    const res = await POST(makeRequest({ applicationId: "app-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendSetupEmail)).toHaveBeenCalledWith(
      pendingApp.contactEmail,
      pendingApp.kitchenName,
      expect.any(String),
    );
  });

  it("returns 401 when the x-internal-key header is an empty string (CRITICAL: auth bypass)", async () => {
    const res = await POST(makeRequest({ applicationId: "app-1" }, ""));

    expect(res.status).toBe(401);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 401 when the x-internal-key header is missing entirely", async () => {
    const req = new Request("http://localhost/api/internal/issue-link", {
      method: "POST",
      body: JSON.stringify({ applicationId: "app-1" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it("returns 401 when the key is wrong", async () => {
    const res = await POST(
      makeRequest({ applicationId: "app-1" }, "wrong-key"),
    );

    expect(res.status).toBe(401);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it("returns 400 when applicationId is missing from the body", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it("returns 404 when the application does not exist", async () => {
    setApplication(null);

    const res = await POST(makeRequest({ applicationId: "does-not-exist" }));

    expect(res.status).toBe(404);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 409 when the application is already approved", async () => {
    setApplication({ ...pendingApp, status: "approved" });

    const res = await POST(makeRequest({ applicationId: "app-1" }));

    expect(res.status).toBe(409);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 409 when the application is in a non-pending_review status (e.g. rejected)", async () => {
    setApplication({ ...pendingApp, status: "rejected" });

    const res = await POST(makeRequest({ applicationId: "app-1" }));

    expect(res.status).toBe(409);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 502 and runs a compensating transaction when the setup email fails", async () => {
    vi.mocked(sendSetupEmail).mockRejectedValue(new Error("Resend down"));

    let transactionCallCount = 0;
    vi.mocked(dbPool.transaction).mockImplementation(async (cb) => {
      transactionCallCount++;
      const tx = {
        insert: vi
          .fn()
          .mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        delete: vi
          .fn()
          .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      return cb(tx as never);
    });

    const res = await POST(makeRequest({ applicationId: "app-1" }));

    expect(res.status).toBe(502);
    expect(transactionCallCount).toBe(2);
  });
});
