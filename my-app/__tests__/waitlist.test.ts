import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { insert: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  waitlist: { email: "email" },
}));

import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { addToWaitlist } from "@/lib/waitlist";

describe("addToWaitlist", () => {
  let mockReturning: ReturnType<typeof vi.fn>;
  let mockOnConflictDoNothing: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReturning = vi.fn().mockResolvedValue([]);
    mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
    mockValues = vi.fn(() => ({
      onConflictDoNothing: mockOnConflictDoNothing,
    }));
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as unknown as ReturnType<typeof db.insert>);
  });

  it("inserts with the correct email and ipHash", async () => {
    await addToWaitlist("user@example.com", "abc123");

    expect(mockValues).toHaveBeenCalledWith({
      email: "user@example.com",
      ipHash: "abc123",
    });
  });

  it("includes the trimmed city when provided", async () => {
    await addToWaitlist("user@example.com", "abc123", "  Toronto  ");

    expect(mockValues).toHaveBeenCalledWith({
      email: "user@example.com",
      ipHash: "abc123",
      city: "Toronto",
    });
  });

  it("omits city when not provided or blank", async () => {
    await addToWaitlist("user@example.com", "abc123", "   ");

    expect(mockValues).toHaveBeenCalledWith({
      email: "user@example.com",
      ipHash: "abc123",
    });
  });

  it("uses onConflictDoNothing so duplicate emails are silently ignored", async () => {
    await addToWaitlist("user@example.com", "abc123");
    expect(mockOnConflictDoNothing).toHaveBeenCalledWith({
      target: waitlist.email,
    });
  });

  it("returns true when a new row is inserted", async () => {
    mockReturning.mockResolvedValue([{ email: "new@example.com" }]);

    const result = await addToWaitlist("new@example.com", "hash123");

    expect(result).toBe(true);
  });

  it("returns false when the email already exists", async () => {
    mockReturning.mockResolvedValue([]);

    const result = await addToWaitlist("existing@example.com", "hash456");

    expect(result).toBe(false);
  });
});
