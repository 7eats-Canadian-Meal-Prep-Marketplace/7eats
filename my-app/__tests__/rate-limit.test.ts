import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  dbPool: {
    transaction: vi.fn(),
  },
}));

import { dbPool } from "@/db";
import { logAndCheckRateLimit } from "@/lib/rate-limit";

describe("logAndCheckRateLimit", () => {
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExecute = vi.fn().mockResolvedValue(undefined);
    mockWhere = vi.fn();
    mockFrom = vi.fn(() => ({ where: mockWhere }));
    mockSelect = vi.fn(() => ({ from: mockFrom }));
    mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    });

    vi.mocked(dbPool.transaction).mockImplementation(async (fn) =>
      fn({
        execute: mockExecute,
        select: mockSelect,
        insert: mockInsert,
      } as never),
    );
  });

  it("acquires an advisory lock before reading the count", async () => {
    mockWhere.mockResolvedValue([{ count: 2 }]);

    await logAndCheckRateLimit("abc123");

    expect(mockExecute).toHaveBeenCalledOnce();
    expect(mockExecute.mock.invocationCallOrder[0]).toBeLessThan(
      mockSelect.mock.invocationCallOrder[0],
    );
  });

  it("inserts a log row and returns true when under the limit", async () => {
    mockWhere.mockResolvedValue([{ count: 2 }]);

    const result = await logAndCheckRateLimit("abc123");

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("returns false and does not insert when count equals max attempts (3)", async () => {
    mockWhere.mockResolvedValue([{ count: 3 }]);

    const result = await logAndCheckRateLimit("abc123");

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("returns false and does not insert when count exceeds max attempts", async () => {
    mockWhere.mockResolvedValue([{ count: 4 }]);

    const result = await logAndCheckRateLimit("abc123");

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("runs the check-and-insert inside a single transaction", async () => {
    mockWhere.mockResolvedValue([{ count: 0 }]);

    await logAndCheckRateLimit("abc123");

    expect(vi.mocked(dbPool.transaction)).toHaveBeenCalledOnce();
  });
});
