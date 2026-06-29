import { describe, expect, it } from "vitest";
import { formatPickupLocation } from "@/lib/address";

describe("formatPickupLocation", () => {
  it("composes a full pickup address including the unit", () => {
    expect(
      formatPickupLocation({
        street: "123 King St W",
        unit: "4B",
        city: "Toronto",
        province: "ON",
        postal: "M5H 1A1",
      }),
    ).toBe("123 King St W, 4B, Toronto, ON, M5H 1A1");
  });

  it("normalizes a full province name to its 2-letter code", () => {
    expect(
      formatPickupLocation({
        street: "1 Main St",
        city: "Toronto",
        province: "Ontario",
        postal: "M5H 1A1",
      }),
    ).toBe("1 Main St, Toronto, ON, M5H 1A1");
  });

  it("omits missing parts without leaving stray separators", () => {
    expect(
      formatPickupLocation({
        street: "1 Main St",
        unit: null,
        city: "Toronto",
        province: "ON",
        postal: null,
      }),
    ).toBe("1 Main St, Toronto, ON");
  });

  it("returns null when nothing is present", () => {
    expect(formatPickupLocation({})).toBeNull();
    expect(
      formatPickupLocation({
        street: "   ",
        city: "",
        province: null,
        postal: undefined,
      }),
    ).toBeNull();
  });
});
