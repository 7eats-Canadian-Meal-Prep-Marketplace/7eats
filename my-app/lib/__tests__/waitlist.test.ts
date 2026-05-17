import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("@/db", () => ({
  db: { insert: mockInsert },
}));

vi.mock("@/db/schema", () => ({
  waitlist: { email: "email" },
}));

describe("addToWaitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when a new row is inserted", async () => {
    mockReturning.mockResolvedValue([{ email: "new@example.com" }]);
    const { addToWaitlist } = await import("@/lib/waitlist");
    const result = await addToWaitlist("new@example.com", "hash123");
    expect(result).toBe(true);
  });

  it("returns false when the email already exists (conflict)", async () => {
    mockReturning.mockResolvedValue([]);
    const { addToWaitlist } = await import("@/lib/waitlist");
    const result = await addToWaitlist("existing@example.com", "hash456");
    expect(result).toBe(false);
  });
});
