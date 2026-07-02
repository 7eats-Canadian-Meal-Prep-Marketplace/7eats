import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

import {
  deliverOrderClientUpdate,
  sendOrderUpdateSms,
  shouldSendOrderUpdateSms,
} from "@/lib/orders/client-notifications";
import { sendSms } from "@/lib/sms";

const client = {
  email: "client@example.com",
  firstName: "Sam",
  phone: "+15149130305",
  phoneVerified: true,
  notificationPreferences: {
    notifs: { order_updates: true, marketing: false },
    channels: { sms: true, email: true },
  },
};

describe("shouldSendOrderUpdateSms", () => {
  it("sends when order updates, SMS channel, and phone are enabled", () => {
    expect(shouldSendOrderUpdateSms(client)).toBe(true);
  });

  it("uses default prefs when notificationPreferences is null", () => {
    expect(
      shouldSendOrderUpdateSms({
        ...client,
        notificationPreferences: null,
      }),
    ).toBe(true);
  });

  it("skips when SMS channel is off", () => {
    expect(
      shouldSendOrderUpdateSms({
        ...client,
        notificationPreferences: {
          notifs: { order_updates: true, marketing: false },
          channels: { sms: false, email: true },
        },
      }),
    ).toBe(false);
  });

  it("skips when phone is not verified", () => {
    expect(shouldSendOrderUpdateSms({ ...client, phoneVerified: false })).toBe(
      false,
    );
  });
});

describe("deliverOrderClientUpdate", () => {
  it("calls Twilio SMS when eligible", async () => {
    await deliverOrderClientUpdate(
      client,
      vi.fn().mockResolvedValue(undefined),
      "7eats: Your order is ready.",
    );

    expect(sendSms).toHaveBeenCalledWith(
      "+15149130305",
      "7eats: Your order is ready.",
    );
  });

  it("does not call Twilio when SMS is disabled", async () => {
    vi.mocked(sendSms).mockClear();
    await sendOrderUpdateSms(
      {
        ...client,
        notificationPreferences: {
          notifs: { order_updates: true, marketing: false },
          channels: { sms: false, email: true },
        },
      },
      "7eats: test",
    );
    expect(sendSms).not.toHaveBeenCalled();
  });
});
