import { describe, it, expect, vi, beforeEach } from "vitest";

let mockReturning = vi.fn();
let mockOnConflictDoNothing: ReturnType<typeof vi.fn>;
let mockValues: ReturnType<typeof vi.fn>;
let mockInsert: ReturnType<typeof vi.fn>;

// Create a factory function to build fresh mock chains
function createMockChain() {
  mockReturning = vi.fn();
  mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
  mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
  mockInsert = vi.fn(() => ({ values: mockValues }));
}

createMockChain();

vi.mock("@/db", () => ({
  db: { insert: mockInsert },
}));

vi.mock("@/db/schema", () => ({
  waitlist: { email: "email" },
}));

describe("addToWaitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMockChain();
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
