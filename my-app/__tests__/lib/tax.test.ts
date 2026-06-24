import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calcTax, getTaxLabel } from "@/lib/tax";

describe("calcTax (collection enabled)", () => {
  const prev = process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = "true";
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = prev;
  });

  it("applies 5% GST in AB", () => {
    expect(calcTax(100, "AB")).toBeCloseTo(5, 2);
  });
  it("applies 13% HST in ON", () => {
    expect(calcTax(100, "ON")).toBeCloseTo(13, 2);
  });
  it("applies 15% HST in NS", () => {
    expect(calcTax(100, "NS")).toBeCloseTo(15, 2);
  });
  it("applies 14.975% QST+GST in QC", () => {
    expect(calcTax(100, "QC")).toBeCloseTo(14.975, 2);
  });
  it("applies 5% GST in YT (territory)", () => {
    expect(calcTax(100, "YT")).toBeCloseTo(5, 2);
  });
  it("defaults to 5% GST for unknown province", () => {
    expect(calcTax(100, "XX")).toBeCloseTo(5, 2);
  });
  it("normalizes lowercase province codes", () => {
    expect(calcTax(100, "on")).toBeCloseTo(13, 2);
  });
});

describe("calcTax (collection disabled)", () => {
  const prev = process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = "false";
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED = prev;
  });

  it("returns 0 regardless of province when collection is off", () => {
    expect(calcTax(100, "ON")).toBe(0);
    expect(calcTax(100, "NS")).toBe(0);
    expect(calcTax(100, "QC")).toBe(0);
  });

  it("treats an unset flag as disabled", () => {
    delete process.env.NEXT_PUBLIC_TAX_COLLECTION_ENABLED;
    expect(calcTax(100, "ON")).toBe(0);
  });
});

describe("getTaxLabel", () => {
  it("returns Ontario HST label", () => {
    expect(getTaxLabel("ON")).toBe("HST (13%)");
  });
});
