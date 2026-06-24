import assert from "node:assert/strict";
import { test } from "node:test";
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

test("fixed discount is capped at subtotal", () => {
  assert.equal(computeDiscountValue(mk({ value: 5 }), 30), 5);
  assert.equal(computeDiscountValue(mk({ value: 50 }), 30), 30);
});

test("percentage discount", () => {
  assert.equal(
    computeDiscountValue(mk({ discountType: "percentage", value: 10 }), 30),
    3,
  );
});

test("percentage respects max cap", () => {
  assert.equal(
    computeDiscountValue(
      mk({ discountType: "percentage", value: 50, maxDiscountAmount: 8 }),
      30,
    ),
    8,
  );
});

test("below min subtotal yields zero", () => {
  assert.equal(
    computeDiscountValue(mk({ value: 5, minOrderSubtotal: 25 }), 20),
    0,
  );
});

test("orders candidates best-first, drops zero", () => {
  const a = mk({ id: "a", value: 5 });
  const b = mk({ id: "b", discountType: "percentage", value: 50 }); // $15 on 30
  const c = mk({ id: "c", value: 5, minOrderSubtotal: 999 }); // 0 → dropped
  const out = orderCandidatesByValue([a, b, c], 30);
  assert.deepEqual(
    out.map((x) => x.discount.id),
    ["b", "a"],
  );
});

test("tie-break prefers most recently created", () => {
  const older = mk({ id: "old", value: 5, createdAt: new Date("2026-01-01") });
  const newer = mk({ id: "new", value: 5, createdAt: new Date("2026-02-01") });
  const out = orderCandidatesByValue([older, newer], 30);
  assert.equal(out[0].discount.id, "new");
});
