import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  tags: { id: "id", slug: "slug", label: "label", category: "category" },
}));
vi.mock("drizzle-orm", () => ({ asc: vi.fn((col) => col) }));

import { GET } from "@/app/api/tags/route";
import { db } from "@/db";

type TagRow = { id: string; slug: string; label: string; category: string };

function setTags(rows: TagRow[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ orderBy }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

describe("GET /api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with success:true and a data array", async () => {
    const mockTags: TagRow[] = [
      { id: "1", slug: "vegetarian", label: "Vegetarian", category: "diet" },
      { id: "2", slug: "spicy", label: "Spicy", category: "flavor" },
    ];
    setTags(mockTags);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockTags);
  });

  it("returns 200 with an empty data array when no tags exist", async () => {
    setTags([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns 500 with success:false when the DB throws", async () => {
    const orderBy = vi.fn().mockRejectedValue(new Error("DB connection lost"));
    const from = vi.fn(() => ({ orderBy }));
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Something went wrong.");
  });
});
