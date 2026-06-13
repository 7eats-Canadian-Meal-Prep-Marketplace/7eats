import { describe, expect, it } from "vitest";
import { calcTax } from "@/app/app/cart/_cart-tax";

describe("calcTax", () => {
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
});
