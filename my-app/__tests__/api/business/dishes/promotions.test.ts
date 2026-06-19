import { describe, expect, it } from "vitest";
import { validatePromotionWindow } from "@/app/api/business/dishes/[dishId]/promotions/_validate";

describe("promotion validUntil XOR maxUses", () => {
  it("rejects when neither is set", () => {
    expect(validatePromotionWindow({}).ok).toBe(false);
  });

  it("rejects when both are set", () => {
    expect(
      validatePromotionWindow({
        maxUses: 10,
        validUntil: "2999-01-01T00:00:00Z",
      }).ok,
    ).toBe(false);
  });

  it("accepts only maxUses", () => {
    expect(validatePromotionWindow({ maxUses: 10 }).ok).toBe(true);
  });

  it("accepts only a future validUntil", () => {
    expect(
      validatePromotionWindow({ validUntil: "2999-01-01T00:00:00Z" }).ok,
    ).toBe(true);
  });

  it("rejects a validUntil in the past", () => {
    expect(
      validatePromotionWindow({ validUntil: "2000-01-01T00:00:00Z" }).ok,
    ).toBe(false);
  });

  it("treats null fields as unset", () => {
    expect(validatePromotionWindow({ maxUses: 5, validUntil: null }).ok).toBe(
      true,
    );
    expect(
      validatePromotionWindow({ maxUses: null, validUntil: null }).ok,
    ).toBe(false);
  });
});
