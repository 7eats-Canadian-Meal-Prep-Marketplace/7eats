import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirrors the price rule used by the dish create/update route schemas.
const priceField = z.number().positive().multipleOf(0.01);

describe("dish price validation", () => {
  it("rejects zero and negative", () => {
    expect(priceField.safeParse(0).success).toBe(false);
    expect(priceField.safeParse(-5).success).toBe(false);
  });

  it("accepts a 2-decimal positive price", () => {
    expect(priceField.safeParse(12.5).success).toBe(true);
    expect(priceField.safeParse(8).success).toBe(true);
  });

  it("rejects sub-cent precision", () => {
    expect(priceField.safeParse(12.555).success).toBe(false);
  });
});
