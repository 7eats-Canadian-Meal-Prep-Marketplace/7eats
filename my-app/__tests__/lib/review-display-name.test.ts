import { describe, expect, it } from "vitest";
import { formatReviewerDisplayName } from "@/lib/reviews/display-name";

describe("formatReviewerDisplayName", () => {
  it("uses first name and last initial", () => {
    expect(formatReviewerDisplayName("Alex", "Smith")).toBe("Alex S.");
  });

  it("falls back to first name only", () => {
    expect(formatReviewerDisplayName("Alex", null)).toBe("Alex");
  });

  it("returns Anonymous when empty", () => {
    expect(formatReviewerDisplayName(null, null)).toBe("Anonymous");
  });
});
