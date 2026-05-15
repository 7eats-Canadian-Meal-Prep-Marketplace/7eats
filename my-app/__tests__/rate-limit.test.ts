import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

import { db } from "@/db";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

describe("logAndCheckRateLimit", () => {
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWhere = vi.fn();
    mockFrom = vi.fn(() => ({ where: mockWhere }));

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
  });

  it("inserts a log row and returns true when under the limit", async () => {
    mockWhere.mockResolvedValue([{ count: 2 }]);

    const result = await logAndCheckRateLimit("abc123");

    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("returns true when count exactly equals max attempts (3)", async () => {
    mockWhere.mockResolvedValue([{ count: 3 }]);

    const result = await logAndCheckRateLimit("abc123");
    expect(result).toBe(true);
  });

  it("returns false when count exceeds max attempts", async () => {
    mockWhere.mockResolvedValue([{ count: 4 }]);

    const result = await logAndCheckRateLimit("abc123");
    expect(result).toBe(false);
  });
});
