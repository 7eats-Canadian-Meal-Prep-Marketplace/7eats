import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

import {
  formatCookNewOrderSmsBody,
  sendCookNewOrderSms,
  shouldSendCookNewOrderSms,
} from "@/lib/cooks/order-notifications";
import { sendSms } from "@/lib/sms";

describe("shouldSendCookNewOrderSms", () => {
  it("sends when SMS is on and phone is verified", () => {
    expect(
      shouldSendCookNewOrderSms({
        smsNotificationsNewOrder: true,
        phoneVerified: true,
        phone: "+15551234567",
      }),
    ).toBe(true);
  });

  it("skips when SMS preference is off", () => {
    expect(
      shouldSendCookNewOrderSms({
        smsNotificationsNewOrder: false,
        phoneVerified: true,
        phone: "+15551234567",
      }),
    ).toBe(false);
  });

  it("skips when phone is not verified", () => {
    expect(
      shouldSendCookNewOrderSms({
        smsNotificationsNewOrder: true,
        phoneVerified: false,
        phone: "+15551234567",
      }),
    ).toBe(false);
  });

  it("skips when phone is missing", () => {
    expect(
      shouldSendCookNewOrderSms({
        smsNotificationsNewOrder: true,
        phoneVerified: true,
        phone: null,
      }),
    ).toBe(false);
  });
});

describe("formatCookNewOrderSmsBody", () => {
  it("includes customer and order summary", () => {
    expect(formatCookNewOrderSmsBody("Jane Doe", "Butter chicken")).toBe(
      "7eats: New order from Jane Doe: Butter chicken. Review in your dashboard.",
    );
  });

  it("truncates very long listing titles", () => {
    const long = "A".repeat(50);
    const body = formatCookNewOrderSmsBody("Jane", long);
    expect(body).toContain("...");
    expect(body.length).toBeLessThan(160);
  });
});

describe("sendCookNewOrderSms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls sendSms when eligible", async () => {
    await sendCookNewOrderSms(
      {
        smsNotificationsNewOrder: true,
        phoneVerified: true,
        phone: "+15551234567",
      },
      "Jane Doe",
      "Butter chicken",
    );

    expect(sendSms).toHaveBeenCalledWith(
      "+15551234567",
      "7eats: New order from Jane Doe: Butter chicken. Review in your dashboard.",
    );
  });

  it("does not call sendSms when ineligible", async () => {
    await sendCookNewOrderSms(
      {
        smsNotificationsNewOrder: true,
        phoneVerified: false,
        phone: "+15551234567",
      },
      "Jane Doe",
      "Butter chicken",
    );

    expect(sendSms).not.toHaveBeenCalled();
  });
});
