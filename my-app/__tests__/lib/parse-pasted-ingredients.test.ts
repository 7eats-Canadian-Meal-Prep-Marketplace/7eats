import { describe, expect, it } from "vitest";
import {
  dedupeAgainst,
  parsePastedNames,
} from "@/lib/dishes/parse-pasted-ingredients";

describe("parsePastedNames", () => {
  it("splits on commas and trims each name", () => {
    expect(parsePastedNames("Tomato, Onion, Garlic")).toEqual([
      "Tomato",
      "Onion",
      "Garlic",
    ]);
  });

  it("splits on newlines", () => {
    expect(parsePastedNames("Tomato\nOnion\nGarlic")).toEqual([
      "Tomato",
      "Onion",
      "Garlic",
    ]);
  });

  it("collapses internal whitespace", () => {
    expect(parsePastedNames("Tomato   paste,  Onion")).toEqual([
      "Tomato paste",
      "Onion",
    ]);
  });

  it("drops empty tokens from trailing/duplicate separators", () => {
    expect(parsePastedNames("Tomato,, Onion,\n,Garlic,")).toEqual([
      "Tomato",
      "Onion",
      "Garlic",
    ]);
  });

  it("returns a single-item array for plain text with no separators", () => {
    expect(parsePastedNames("Tomato paste")).toEqual(["Tomato paste"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parsePastedNames("   ")).toEqual([]);
  });
});

describe("dedupeAgainst", () => {
  it("filters out names already present, case-insensitively", () => {
    const result = dedupeAgainst(["Tomato", "Onion"], ["tomato", "Garlic"]);
    expect(result.added).toEqual(["Garlic"]);
    expect(result.duplicateCount).toBe(1);
  });

  it("dedupes within the candidate batch itself", () => {
    const result = dedupeAgainst([], ["Garlic", "garlic", "Onion"]);
    expect(result.added).toEqual(["Garlic", "Onion"]);
    expect(result.duplicateCount).toBe(1);
  });

  it("adds everything when nothing overlaps", () => {
    const result = dedupeAgainst(["Salt"], ["Pepper", "Sugar"]);
    expect(result.added).toEqual(["Pepper", "Sugar"]);
    expect(result.duplicateCount).toBe(0);
  });

  it("returns an empty added list when all candidates are duplicates", () => {
    const result = dedupeAgainst(["Salt", "Pepper"], ["salt", "PEPPER"]);
    expect(result.added).toEqual([]);
    expect(result.duplicateCount).toBe(2);
  });
});
