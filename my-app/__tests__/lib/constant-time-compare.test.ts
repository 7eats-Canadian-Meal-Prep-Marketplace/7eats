import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "@/lib/constant-time-compare";

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("Bearer secret123", "Bearer secret123")).toBe(
      true,
    );
  });

  it("returns false for different strings of the same length", () => {
    expect(constantTimeEqual("Bearer secret123", "Bearer secret456")).toBe(
      false,
    );
  });

  it("returns false for different strings of different lengths", () => {
    expect(
      constantTimeEqual("Bearer short", "Bearer a-much-longer-value"),
    ).toBe(false);
  });

  it("returns false when one input is empty", () => {
    expect(constantTimeEqual("", "Bearer secret123")).toBe(false);
  });

  it("returns true when both inputs are empty", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
