import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/internal/_lib", () => ({
  verifyInternalKey: vi.fn(),
  hashToken: vi.fn(() => "token-hash-abc"),
  sendSetupEmail: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), delete: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  cookApplications: { id: "id", status: "status" },
  setupTokens: {
    applicationId: "appId",
    tokenHash: "hash",
    consumedAt: "consumedAt",
    id: "id",
  },
}));

import {
  hashToken,
  sendSetupEmail,
  verifyInternalKey,
} from "@/app/api/internal/_lib";
import { POST } from "@/app/api/internal/reissue-link/route";
import { db, dbPool } from "@/db";

function makeRequest(body: unknown, key = "valid-key"): Request {
  return new Request("http://localhost/api/internal/reissue-link", {
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
  vi.mocked(dbPool.transaction).mockImplementation(async (cb) =>
    cb(tx as never),
  );
  return tx;
}

function setDbDelete() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as never);
}

const approvedApp: ApplicationRow = {
  id: "app-2",
  status: "approved",
  contactEmail: "chef@example.com",
  kitchenName: "The Great Kitchen",
};

describe("POST /api/internal/reissue-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyInternalKey).mockImplementation(
      (key) => key === "valid-key",
    );
    vi.mocked(hashToken).mockReturnValue("token-hash-abc");
    vi.mocked(sendSetupEmail).mockResolvedValue(undefined);
    setApplication(approvedApp);
    makeTransactionMock();
    setDbDelete();
  });

  it("returns 200 { ok: true } for a valid key and an approved application", async () => {
    const res = await POST(makeRequest({ applicationId: "app-2" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendSetupEmail)).toHaveBeenCalledWith(
      approvedApp.contactEmail,
      approvedApp.kitchenName,
      expect.any(String),
    );
  });

  it("returns 401 when the x-internal-key header is an empty string", async () => {
    const res = await POST(makeRequest({ applicationId: "app-2" }, ""));

    expect(res.status).toBe(401);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
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

  it("returns 409 when the application is not approved (e.g. pending_review)", async () => {
    setApplication({ ...approvedApp, status: "pending_review" });

    const res = await POST(makeRequest({ applicationId: "app-2" }));

    expect(res.status).toBe(409);
    expect(vi.mocked(dbPool.transaction)).not.toHaveBeenCalled();
  });

  it("returns 502 and deletes the new token via db.delete when the email fails", async () => {
    vi.mocked(sendSetupEmail).mockRejectedValue(new Error("Resend down"));

    const res = await POST(makeRequest({ applicationId: "app-2" }));

    expect(res.status).toBe(502);
    expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
  });

  it("expires old tokens and inserts a new token in a single transaction", async () => {
    const tx = makeTransactionMock();

    await POST(makeRequest({ applicationId: "app-2" }));

    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });
});
