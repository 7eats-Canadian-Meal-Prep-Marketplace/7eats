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

vi.mock("@/lib/storage/avatars", () => ({
  uploadAvatar: vi.fn(),
  avatarKeyFromUrl: vi.fn(),
  deleteAvatar: vi.fn(),
}));

vi.mock("@/lib/upload-validation", () => ({
  sniffFileType: vi.fn(),
}));

import { DELETE, POST } from "@/app/api/user/profile/photo/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  avatarKeyFromUrl,
  deleteAvatar,
  uploadAvatar,
} from "@/lib/storage/avatars";
import { sniffFileType } from "@/lib/upload-validation";

const USER_ID = "user-uuid-1234";
const AVATAR_URL = "https://avatars.example.com/avatars/user-uuid-1234/pic.jpg";

function mockSession(role: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    role ? ({ user: { id: USER_ID, role } } as never) : (null as never),
  );
}

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function makePhotoRequest(file?: File) {
  const fd = new FormData();
  if (file) fd.set("photo", file);
  return new Request("http://localhost/api/user/profile/photo", {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/user/profile/photo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await POST(makePhotoRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 for non-client users", async () => {
    mockSession("cook");
    const res = await POST(makePhotoRequest());
    expect(res.status).toBe(401);
  });

  it("returns 400 when photo is missing", async () => {
    mockSession("client");
    const res = await POST(makePhotoRequest());
    expect(res.status).toBe(400);
  });

  it("uploads a valid JPEG and updates the user image", async () => {
    mockSession("client");
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.jpg", {
      type: "image/jpeg",
    });
    vi.mocked(sniffFileType).mockReturnValue("image/jpeg");
    vi.mocked(uploadAvatar).mockResolvedValue("https://cdn.example/avatar.jpg");
    const returning = vi
      .fn()
      .mockResolvedValue([{ image: "https://cdn.example/avatar.jpg" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await POST(makePhotoRequest(file));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.image).toBe("https://cdn.example/avatar.jpg");
    expect(uploadAvatar).toHaveBeenCalled();
  });
});

describe("DELETE /api/user/profile/photo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const res = await DELETE(
      new Request("http://localhost/api/user/profile/photo", {
        method: "DELETE",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("clears image and deletes storage object", async () => {
    mockSession("client");
    vi.mocked(db.select).mockImplementation(() =>
      limitChain([{ image: AVATAR_URL }]),
    );
    vi.mocked(avatarKeyFromUrl).mockReturnValue(
      "avatars/user-uuid-1234/pic.jpg",
    );
    vi.mocked(deleteAvatar).mockResolvedValue(undefined);
    const returning = vi.fn().mockResolvedValue([{ image: null }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await DELETE(
      new Request("http://localhost/api/user/profile/photo", {
        method: "DELETE",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.image).toBeNull();
    expect(deleteAvatar).toHaveBeenCalledWith("avatars/user-uuid-1234/pic.jpg");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ image: null }));
  });
});
