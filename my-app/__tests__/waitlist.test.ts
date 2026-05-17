import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { insert: vi.fn() },
}));

import { db } from "@/db";
import { addToWaitlist } from "@/lib/waitlist";

describe("addToWaitlist", () => {
  let mockOnConflictDoNothing: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOnConflictDoNothing = vi.fn().mockResolvedValue([]);
    mockValues = vi.fn(() => ({
      onConflictDoNothing: mockOnConflictDoNothing,
    }));
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);
  });

  it("inserts with the correct email and ipHash", async () => {
    await addToWaitlist("user@example.com", "abc123");

    expect(mockValues).toHaveBeenCalledWith({
      email: "user@example.com",
      ipHash: "abc123",
    });
  });

  it("uses onConflictDoNothing so duplicate emails are silently ignored", async () => {
    await addToWaitlist("user@example.com", "abc123");
    expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
  });
});
