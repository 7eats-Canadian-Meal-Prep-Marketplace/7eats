import { describe, expect, it } from "vitest";
import { SEARCH_MAX_QUERY_LEN } from "@/lib/search/config";
import { boundingBox, normalizeQuery } from "@/lib/search/normalize";

describe("normalizeQuery", () => {
  it("returns empty string for nullish/blank input", () => {
    expect(normalizeQuery(null)).toBe("");
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery("   ")).toBe("");
  });

  it("trims, lower-cases and collapses whitespace", () => {
    expect(normalizeQuery("  Chicken   Shawarma  ")).toBe("chicken shawarma");
    expect(normalizeQuery("GREEK\tFOOD")).toBe("greek food");
  });

  it("clamps to the max query length", () => {
    const long = "a".repeat(SEARCH_MAX_QUERY_LEN + 50);
    expect(normalizeQuery(long).length).toBe(SEARCH_MAX_QUERY_LEN);
  });
});

describe("boundingBox", () => {
  it("produces a symmetric box around the point", () => {
    const box = boundingBox(43.65, -79.38, 10);
    expect(box.maxLat).toBeGreaterThan(43.65);
    expect(box.minLat).toBeLessThan(43.65);
    expect(box.maxLng).toBeGreaterThan(-79.38);
    expect(box.minLng).toBeLessThan(-79.38);
    // Latitude delta is ~radius/111 degrees.
    expect(box.maxLat - 43.65).toBeCloseTo(10 / 111, 5);
  });

  it("widens longitude span as latitude increases", () => {
    const low = boundingBox(0, 0, 10);
    const high = boundingBox(60, 0, 10);
    const lowSpan = low.maxLng - low.minLng;
    const highSpan = high.maxLng - high.minLng;
    expect(highSpan).toBeGreaterThan(lowSpan);
  });

  it("does not blow up near the poles", () => {
    const box = boundingBox(89.999, 0, 10);
    expect(Number.isFinite(box.minLng)).toBe(true);
    expect(Number.isFinite(box.maxLng)).toBe(true);
  });
});
