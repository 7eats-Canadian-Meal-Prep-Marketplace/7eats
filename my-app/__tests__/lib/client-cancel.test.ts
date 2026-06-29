import { describe, expect, it } from "vitest";
import {
  getClientCancelPolicy,
  isClientOrderCancellable,
  isClientRefundEligible,
} from "@/lib/orders/client-cancel-policy";

describe("isClientOrderCancellable", () => {
  it("allows pending and confirmed regardless of cook refund policy", () => {
    expect(isClientOrderCancellable({ status: "pending" })).toBe(true);
    expect(isClientOrderCancellable({ status: "confirmed" })).toBe(true);
  });

  it("blocks ready and later stages", () => {
    expect(isClientOrderCancellable({ status: "ready" })).toBe(false);
    expect(isClientOrderCancellable({ status: "fulfilled" })).toBe(false);
  });
});

describe("isClientRefundEligible", () => {
  it("always refunds pending orders before cook confirmation", () => {
    expect(
      isClientRefundEligible({
        status: "pending",
        cancellationAllowed: false,
        pickupAt: null,
        cookLeadTime: "3_days",
      }),
    ).toBe(true);
  });

  it("does not refund confirmed orders when cook disallows cancellation", () => {
    expect(
      isClientRefundEligible({
        status: "confirmed",
        cancellationAllowed: false,
        pickupAt: null,
        cookLeadTime: "3_days",
      }),
    ).toBe(false);
  });

  it("refunds before lead cutoff using fulfillment window", () => {
    const now = new Date("2026-06-20T12:00:00");
    expect(
      isClientRefundEligible({
        status: "confirmed",
        cancellationAllowed: true,
        pickupAt: null,
        fulfillmentWindowStart: "2026-06-27T15:00:00.000Z",
        cookLeadTime: "3_days",
        now,
      }),
    ).toBe(true);
  });
});

describe("getClientCancelPolicy", () => {
  it("promises a refund for pending orders even when cook policy is final sale", () => {
    const policy = getClientCancelPolicy({
      status: "pending",
      cancellationAllowed: false,
      pickupAt: null,
      cookLeadTime: "3_days",
    });
    expect(policy.cancellable).toBe(true);
    expect(policy.refundEligible).toBe(true);
    expect(policy.summary).toContain("hasn't confirmed");
  });

  it("explains no refund when cook policy is final sale after confirmation", () => {
    const policy = getClientCancelPolicy({
      status: "confirmed",
      cancellationAllowed: false,
      pickupAt: null,
      cookLeadTime: "3_days",
    });
    expect(policy.cancellable).toBe(true);
    expect(policy.refundEligible).toBe(false);
    expect(policy.summary).toContain("does not offer refunds");
  });

  it("includes refund deadline label when eligible", () => {
    const now = new Date("2026-06-20T12:00:00");
    const policy = getClientCancelPolicy({
      status: "confirmed",
      cancellationAllowed: true,
      pickupAt: null,
      fulfillmentWindowStart: "2026-06-27T15:00:00.000Z",
      cookLeadTime: "3_days",
      fulfillmentMode: "delivery",
      now,
    });
    expect(policy.refundEligible).toBe(true);
    expect(policy.refundDeadlineLabel).not.toBeNull();
    expect(policy.summary).toContain("You'll receive a full refund");
    expect(policy.summary).toContain(policy.refundDeadlineLabel ?? "");
    expect(policy.detail).toBe("");
  });

  it("states no refund when past the deadline", () => {
    const now = new Date("2026-06-25T12:00:00");
    const policy = getClientCancelPolicy({
      status: "confirmed",
      cancellationAllowed: true,
      pickupAt: null,
      fulfillmentWindowStart: "2026-06-27T15:00:00.000Z",
      cookLeadTime: "3_days",
      fulfillmentMode: "pickup",
      now,
    });
    expect(policy.refundEligible).toBe(false);
    expect(policy.summary).toMatch(/^No refund\./);
    expect(policy.summary).toContain(policy.refundDeadlineLabel ?? "");
  });
});
