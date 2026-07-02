import { describe, expect, it } from "vitest";
import { classifyRegion } from "@/lib/service-areas";

describe("classifyRegion", () => {
  it("treats the active province (ON) at city granularity", () => {
    expect(classifyRegion({ city: "Ottawa", province: "ON" })).toEqual({
      kind: "active-province",
      place: "Ottawa",
    });
  });

  it("falls back to a generic place name when the ON city is blank", () => {
    expect(classifyRegion({ city: "", province: "on" })).toEqual({
      kind: "active-province",
      place: "your area",
    });
  });

  it("names the province for other Canadian provinces", () => {
    expect(classifyRegion({ city: "Vancouver", province: "BC" })).toEqual({
      kind: "other-province",
      place: "British Columbia",
    });
    expect(classifyRegion({ city: "Montreal", province: "qc" })).toEqual({
      kind: "other-province",
      place: "Quebec",
    });
  });

  it("flags non-Canadian addresses (e.g. US state codes)", () => {
    expect(classifyRegion({ city: "Los Angeles", province: "CA" })).toEqual({
      kind: "outside-canada",
    });
    expect(classifyRegion({ city: "Seattle", province: "WA" })).toEqual({
      kind: "outside-canada",
    });
  });

  it("treats an unknown/empty province as outside Canada", () => {
    expect(classifyRegion({ city: "", province: "" })).toEqual({
      kind: "outside-canada",
    });
  });
});
