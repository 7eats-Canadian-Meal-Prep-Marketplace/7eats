import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  cookCertifications: {},
  cookPickupWindows: {},
  cookProfiles: {},
  cookProfileTags: {},
  tags: {},
}));

vi.mock("@/lib/storage/certs", () => ({
  uploadCert: vi.fn(),
}));

vi.mock("@/lib/upload-validation", () => ({
  sniffFileType: vi.fn(),
}));

import { POST } from "@/app/api/setup/onboarding/[step]/route";
import { db, dbPool } from "@/db";
import { auth } from "@/lib/auth";
import { uploadCert } from "@/lib/storage/certs";
import { sniffFileType } from "@/lib/upload-validation";

const USER_ID = "user-uuid";
const COOK_ID = "cook-uuid";
const USER_NAME = "Jane Doe";
const PROFILE = { id: COOK_ID, currentSetupStep: 2 };

function mockSession(id: string | null, name = USER_NAME) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    id ? ({ user: { id, name, role: "cook" } } as never) : null,
  );
}

function mockSelects(profile: object | null, existingCert: object | null) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const idx = call++;
    const rows =
      idx === 0
        ? profile
          ? [profile]
          : []
        : existingCert
          ? [existingCert]
          : [];
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ limit, orderBy }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

function mockTransaction() {
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));
  const valuesFn = vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn(() => ({ values: valuesFn }));
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn(() => ({ where: updateWhere }));
  const updateFn = vi.fn(() => ({ set: setFn }));
  const tx = { delete: deleteFn, insert: insertFn, update: updateFn };
  vi.mocked(dbPool.transaction).mockImplementation(async (cb) =>
    cb(tx as never),
  );
  return { deleteFn, insertFn, valuesFn, updateFn, setFn };
}

function makeRequest(file?: File) {
  const fd = new FormData();
  if (file) fd.set("certPhoto", file);
  return new Request("http://localhost/api/setup/onboarding/3", {
    method: "POST",
    body: fd,
  });
}

function callStep3(req: Request) {
  return POST(req, { params: Promise.resolve({ step: "3" }) });
}

describe("POST /api/setup/onboarding/3 (certification step)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when no photo is uploaded and none exists yet", async () => {
    mockSession(USER_ID);
    mockSelects(PROFILE, null);

    const res = await callStep3(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/upload a photo/i);
    expect(dbPool.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the cook profile is not found", async () => {
    mockSession(USER_ID);
    mockSelects(null, null);

    const res = await callStep3(makeRequest());
    expect(res.status).toBe(404);
  });

  it("rejects an unsupported certificate file type", async () => {
    mockSession(USER_ID);
    mockSelects(PROFILE, null);
    const file = new File([new Uint8Array([1, 2, 3])], "cert.gif", {
      type: "image/gif",
    });

    const res = await callStep3(makeRequest(file));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/JPEG, PNG, or PDF/i);
    expect(uploadCert).not.toHaveBeenCalled();
  });

  it("uploads a new certificate photo and stores the account holder's name", async () => {
    mockSession(USER_ID, USER_NAME);
    mockSelects(PROFILE, null);
    const { insertFn, valuesFn } = mockTransaction();
    const file = new File([new Uint8Array([1, 2, 3])], "cert.png", {
      type: "image/png",
    });
    vi.mocked(sniffFileType).mockReturnValue("image/png");
    vi.mocked(uploadCert).mockResolvedValue("certs/cook-uuid/123-cert.png");

    const res = await callStep3(makeRequest(file));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(uploadCert).toHaveBeenCalledWith(
      COOK_ID,
      "cert.png",
      expect.any(Buffer),
      "image/png",
    );
    expect(insertFn).toHaveBeenCalled();
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        cookId: COOK_ID,
        holderName: USER_NAME,
        fileUrl: "certs/cook-uuid/123-cert.png",
      }),
    );
    expect(valuesFn.mock.calls[0][0]).not.toHaveProperty("certificateNumber");
    expect(valuesFn.mock.calls[0][0]).not.toHaveProperty("expiresAt");
  });

  it("carries forward the existing file when resubmitting without a new upload", async () => {
    mockSession(USER_ID, USER_NAME);
    mockSelects(PROFILE, { fileUrl: "certs/cook-uuid/old-cert.png" });
    const { valuesFn } = mockTransaction();

    const res = await callStep3(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(uploadCert).not.toHaveBeenCalled();
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrl: "certs/cook-uuid/old-cert.png",
      }),
    );
  });
});
