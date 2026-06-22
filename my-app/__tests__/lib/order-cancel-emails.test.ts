import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({
  sendMail: sendMailMock,
}));

import {
  sendOrderCancelledByClientEmailToClient,
  sendOrderCancelledByClientEmailToCook,
} from "@/lib/emails/order-events";

beforeEach(() => {
  sendMailMock.mockClear();
  process.env.NEXT_PUBLIC_APP_URL = "https://7eats.test";
});

describe("client cancellation emails", () => {
  const order = {
    id: "order-1",
    listingTitle: "Jamaican Patty",
    quantity: 5,
    totalPrice: "47.43",
    currency: "CAD",
    pickupAt: null,
    fulfillmentMode: "pickup" as const,
    fulfillmentWindowStart: "2026-06-27T22:00:00.000Z",
    fulfillmentWindowEnd: "2026-06-28T02:00:00.000Z",
  };

  it("cook email uses fulfillment window timing and refund outcome", async () => {
    await sendOrderCancelledByClientEmailToCook(
      { email: "cook@test.com", firstName: "Chef" },
      { name: "Hendrik Tebeng" },
      order,
      { refunded: true },
    );

    expect(sendMailMock).toHaveBeenCalledOnce();
    const { text, subject } = sendMailMock.mock.calls[0][0];
    expect(subject).toContain("Hendrik Tebeng");
    expect(text).not.toContain("scheduled for TBD");
    expect(text).toContain("refunded in full");
  });

  it("cook email omits schedule when timing is unknown", async () => {
    await sendOrderCancelledByClientEmailToCook(
      { email: "cook@test.com", firstName: "Chef" },
      { name: "Hendrik Tebeng" },
      {
        ...order,
        fulfillmentWindowStart: null,
        fulfillmentWindowEnd: null,
      },
      { refunded: true },
    );

    const { text } = sendMailMock.mock.calls[0][0];
    expect(text).not.toContain("scheduled for");
    expect(text).not.toContain("TBD");
    expect(text).toContain("5× Jamaican Patty.");
  });

  it("client email confirms cancellation and refund", async () => {
    await sendOrderCancelledByClientEmailToClient(
      { email: "client@test.com", firstName: "Hendrik" },
      { name: "The Jamaican Gold Rush" },
      order,
      {
        refunded: true,
        confirmationCode: "7E-ABC123",
        isGuestCheckout: true,
        receiptUrl:
          "https://7eats.test/app/checkout/guest-confirmation?token=tok",
      },
    );

    expect(sendMailMock).toHaveBeenCalledOnce();
    const { text, subject } = sendMailMock.mock.calls[0][0];
    expect(subject).toContain("cancelled");
    expect(text).toContain("payment has been released");
    expect(text).toContain("7E-ABC123");
    expect(text).not.toContain("TBD");
  });
});
