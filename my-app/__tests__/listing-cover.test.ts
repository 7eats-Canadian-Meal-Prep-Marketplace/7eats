import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  listings: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));
vi.mock("@/lib/storage/listings", () => ({
  uploadListingPhoto: vi.fn(),
}));

import { POST } from "@/app/api/business/listings/[listingId]/cover/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { uploadListingPhoto } from "@/lib/storage/listings";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";
const LISTING_ID = "listing-uuid";
const CDN_URL = "https://cdn.7eats.test/listings/listing-uuid/123-cover.png";

// Valid PNG magic bytes so the real sniffFileType accepts the upload.
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

function mockSession(userId: string | null, role = "cook") {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role } } as never) : null,
  );
}

// First select = cook lookup (inside getCookId); second = listing ownership.
function mockSelects(listingRow: object | null) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    call++;
    const rows =
      call === 1 ? [{ id: COOK_ID }] : listingRow ? [listingRow] : [];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

function mockUpdateOk() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set };
}

function makePost(file: File | null): Request {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return new Request(
    `http://localhost/api/business/listings/${LISTING_ID}/cover`,
    {
      method: "POST",
      body: fd,
    },
  );
}

const params = { params: Promise.resolve({ listingId: LISTING_ID }) };

describe("POST /api/business/listings/[listingId]/cover", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(
      makePost(new File([PNG_BYTES], "c.png", { type: "image/png" })),
      params,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the listing is not owned by the cook", async () => {
    mockSession(USER_ID);
    mockSelects(null);
    const res = await POST(
      makePost(new File([PNG_BYTES], "c.png", { type: "image/png" })),
      params,
    );
    expect(res.status).toBe(404);
    expect(vi.mocked(uploadListingPhoto)).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is provided", async () => {
    mockSession(USER_ID);
    mockSelects({ id: LISTING_ID });
    const res = await POST(makePost(null), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a disallowed mime type", async () => {
    mockSession(USER_ID);
    mockSelects({ id: LISTING_ID });
    const res = await POST(
      makePost(new File([PNG_BYTES], "c.gif", { type: "image/gif" })),
      params,
    );
    expect(res.status).toBe(400);
    expect(vi.mocked(uploadListingPhoto)).not.toHaveBeenCalled();
  });

  it("returns 400 when the bytes don't match a real image", async () => {
    mockSession(USER_ID);
    mockSelects({ id: LISTING_ID });
    const bogus = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const res = await POST(
      makePost(new File([bogus], "c.png", { type: "image/png" })),
      params,
    );
    expect(res.status).toBe(400);
    expect(vi.mocked(uploadListingPhoto)).not.toHaveBeenCalled();
  });

  it("returns 400 when the file exceeds 5 MB", async () => {
    mockSession(USER_ID);
    mockSelects({ id: LISTING_ID });
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG_BYTES);
    const res = await POST(
      makePost(new File([big], "c.png", { type: "image/png" })),
      params,
    );
    expect(res.status).toBe(400);
    expect(vi.mocked(uploadListingPhoto)).not.toHaveBeenCalled();
  });

  it("uploads, persists coverPhotoUrl, and returns the URL", async () => {
    mockSession(USER_ID);
    mockSelects({ id: LISTING_ID });
    const { set } = mockUpdateOk();
    vi.mocked(uploadListingPhoto).mockResolvedValue(CDN_URL);

    const res = await POST(
      makePost(new File([PNG_BYTES], "c.png", { type: "image/png" })),
      params,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.coverPhotoUrl).toBe(CDN_URL);
    expect(vi.mocked(uploadListingPhoto)).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ coverPhotoUrl: CDN_URL });
  });

  it("returns 500 when the upload throws", async () => {
    mockSession(USER_ID);
    mockSelects({ id: LISTING_ID });
    vi.mocked(uploadListingPhoto).mockRejectedValue(new Error("r2 down"));

    const res = await POST(
      makePost(new File([PNG_BYTES], "c.png", { type: "image/png" })),
      params,
    );
    expect(res.status).toBe(500);
  });
});
