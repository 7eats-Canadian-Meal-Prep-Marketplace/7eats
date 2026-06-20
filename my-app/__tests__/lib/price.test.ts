import { describe, expect, it } from "vitest";
import { isPriceKeystroke, isValidPrice } from "@/lib/price";

describe("isPriceKeystroke", () => {
  it("allows empty and partial in-progress values", () => {
    for (const v of ["", "1", "12", "12.", "12.5", "12.50", ".5", ".50"]) {
      expect(isPriceKeystroke(v)).toBe(true);
    }
  });

  it("rejects letters, symbols, and more than two decimals", () => {
    for (const v of ["12a", "1,5", "$5", "1.234", "1.2.3", "1e3", "-1", " 1"]) {
      expect(isPriceKeystroke(v)).toBe(false);
    }
  });
});

describe("isValidPrice", () => {
  it("accepts well-formed positive prices with up to two decimals", () => {
    for (const v of ["1", "12", "12.5", "12.50", "0.01", "9999.99"]) {
      expect(isValidPrice(v)).toBe(true);
    }
  });

  it("trims surrounding whitespace", () => {
    expect(isValidPrice("  12.50  ")).toBe(true);
  });

  it("rejects empty, zero, negatives, letters, and extra decimals", () => {
    for (const v of [
      "",
      "0",
      "0.00",
      "-1",
      "12a",
      "1.234",
      "1,5",
      "$5",
      "1e3",
    ]) {
      expect(isValidPrice(v)).toBe(false);
    }
  });
});
