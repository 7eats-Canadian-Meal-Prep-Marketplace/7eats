import { describe, expect, it } from "vitest";
import type { PlatformDiscountRow } from "@/lib/orders/platform-discount";
import {
  buildPlatformDiscountTeaser,
  formatPlatformDiscountHeadline,
  formatPlatformDiscountQualifier,
} from "@/lib/orders/platform-discount-teaser";

function mk(p: Partial<PlatformDiscountRow>): PlatformDiscountRow {
  return {
    id: "disc_1",
    discountType: "fixed",
    value: 10,
    maxDiscountAmount: null,
    minOrderSubtotal: 25,
    perUserLimit: 1,
    createdAt: new Date("2026-01-01"),
    ...p,
  };
}

describe("platform discount teaser copy", () => {
  it("formats fixed and percentage headlines", () => {
    expect(formatPlatformDiscountHeadline(mk({ value: 10 }))).toBe(
      "Get $10 off",
    );
    expect(
      formatPlatformDiscountHeadline(
        mk({ discountType: "percentage", value: 15 }),
      ),
    ).toBe("Get 15% off");
  });

  it("formats qualifiers for minimum and cap", () => {
    expect(formatPlatformDiscountQualifier(mk({ value: 10 }))).toBe(
      "on orders over $25",
    );
    expect(
      formatPlatformDiscountQualifier(
        mk({
          discountType: "percentage",
          value: 10,
          maxDiscountAmount: 8,
          minOrderSubtotal: null,
        }),
      ),
    ).toBe("up to $8 off");
  });

  it("builds teaser from active discounts below minimum", () => {
    const teaser = buildPlatformDiscountTeaser(
      [mk({ id: "mega", value: 10 })],
      "Mega Discount",
      20,
    );
    expect(teaser?.headline).toBe("Get $10 off");
    expect(teaser?.qualifier).toBe("on orders over $25");
    expect(teaser?.projectedAmount).toBe(0);
  });

  it("projects amount when subtotal qualifies", () => {
    const teaser = buildPlatformDiscountTeaser(
      [mk({ id: "mega", value: 10 })],
      "Mega Discount",
      40,
    );
    expect(teaser?.projectedAmount).toBe(10);
  });
});
