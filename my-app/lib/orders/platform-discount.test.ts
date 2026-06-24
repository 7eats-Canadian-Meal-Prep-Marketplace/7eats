import { describe, expect, it } from "vitest";
import {
  computeDiscountValue,
  orderCandidatesByValue,
  type PlatformDiscountRow,
} from "./platform-discount";

function mk(p: Partial<PlatformDiscountRow>): PlatformDiscountRow {
  return {
    id: "x",
    discountType: "fixed",
    value: 5,
    maxDiscountAmount: null,
    minOrderSubtotal: null,
    perUserLimit: 1,
    createdAt: new Date("2026-01-01"),
    ...p,
  };
}

describe("computeDiscountValue", () => {
  it("fixed discount is capped at subtotal", () => {
    expect(computeDiscountValue(mk({ value: 5 }), 30)).toBe(5);
    expect(computeDiscountValue(mk({ value: 50 }), 30)).toBe(30);
  });

  it("percentage discount", () => {
    expect(
      computeDiscountValue(mk({ discountType: "percentage", value: 10 }), 30),
    ).toBe(3);
  });

  it("percentage respects max cap", () => {
    expect(
      computeDiscountValue(
        mk({ discountType: "percentage", value: 50, maxDiscountAmount: 8 }),
        30,
      ),
    ).toBe(8);
  });

  it("below min subtotal yields zero", () => {
    expect(
      computeDiscountValue(mk({ value: 5, minOrderSubtotal: 25 }), 20),
    ).toBe(0);
  });
});

describe("orderCandidatesByValue", () => {
  it("orders candidates best-first, drops zero", () => {
    const a = mk({ id: "a", value: 5 });
    const b = mk({ id: "b", discountType: "percentage", value: 50 }); // $15 on 30
    const c = mk({ id: "c", value: 5, minOrderSubtotal: 999 }); // 0 → dropped
    const out = orderCandidatesByValue([a, b, c], 30);
    expect(out.map((x) => x.discount.id)).toEqual(["b", "a"]);
  });

  it("tie-break prefers most recently created", () => {
    const older = mk({
      id: "old",
      value: 5,
      createdAt: new Date("2026-01-01"),
    });
    const newer = mk({
      id: "new",
      value: 5,
      createdAt: new Date("2026-02-01"),
    });
    const out = orderCandidatesByValue([older, newer], 30);
    expect(out[0].discount.id).toBe("new");
  });
});
