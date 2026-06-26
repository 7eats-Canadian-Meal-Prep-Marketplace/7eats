import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({
  sendMail: sendMailMock,
}));

import { sendOrderReadyEmailToClient } from "@/lib/emails/order-events";

beforeEach(() => {
  sendMailMock.mockClear();
  process.env.NEXT_PUBLIC_APP_URL = "https://7eats.test";
});

const client = { email: "client@test.com", firstName: "Sam" };
const cook = { name: "Hendrik Tebeng" };

describe("order ready email — delivery", () => {
  const deliveryOrder = {
    id: "order-1",
    listingTitle: "Jollof Rice",
    quantity: 2,
    totalPrice: "30.00",
    currency: "CAD",
    fulfillmentMode: "delivery" as const,
    // Cook's chosen arrival minute (local), pinned on the order before send.
    pickupAt: new Date(2026, 5, 26, 17, 30, 0),
    fulfillmentWindowStart: new Date(2026, 5, 26, 16, 0, 0),
    fulfillmentWindowEnd: new Date(2026, 5, 26, 18, 0, 0),
  };

  it("frames the arrival time as an approximation with 'around' and the time", async () => {
    await sendOrderReadyEmailToClient(client, cook, deliveryOrder, "123456");
    expect(sendMailMock).toHaveBeenCalledOnce();
    const { text, html } = sendMailMock.mock.calls[0][0];
    expect(text.toLowerCase()).toContain("around");
    expect(text).toContain("5:30"); // 17:30 local
    expect(html).toContain("5:30");
  });

  it("tells the customer someone must be present to hand over the code", async () => {
    await sendOrderReadyEmailToClient(client, cook, deliveryOrder, "123456");
    const { text } = sendMailMock.mock.calls[0][0];
    const lower = text.toLowerCase();
    expect(lower).toContain("someone");
    expect(lower).toContain("code");
    // It is explicitly not a leave-at-door handoff.
    expect(lower).toMatch(/hand|present|available/);
  });

  it("drops the inaccurate fixed '24 hours' expiry claim", async () => {
    await sendOrderReadyEmailToClient(client, cook, deliveryOrder, "123456");
    const { text } = sendMailMock.mock.calls[0][0];
    expect(text).not.toContain("expires 24 hours");
  });

  it("does not use em dashes in customer-facing copy", async () => {
    await sendOrderReadyEmailToClient(client, cook, deliveryOrder, "123456");
    const { text, html } = sendMailMock.mock.calls[0][0];
    expect(text).not.toMatch(/\u2014/);
    expect(html).not.toMatch(/\u2014/);
  });

  it("labels the code as a delivery code", async () => {
    await sendOrderReadyEmailToClient(client, cook, deliveryOrder, "123456");
    const { subject } = sendMailMock.mock.calls[0][0];
    expect(subject.toLowerCase()).toContain("delivery code");
  });
});

describe("order ready email — pickup", () => {
  const pickupOrder = {
    id: "order-2",
    listingTitle: "Beef Patty",
    quantity: 3,
    totalPrice: "18.00",
    currency: "CAD",
    fulfillmentMode: "pickup" as const,
    pickupAt: null,
    fulfillmentWindowStart: new Date(2026, 5, 26, 11, 0, 0),
    fulfillmentWindowEnd: new Date(2026, 5, 26, 14, 0, 0),
  };

  it("still sends a pickup-code email without arrival/delivery wording", async () => {
    await sendOrderReadyEmailToClient(client, cook, pickupOrder, "654321");
    const { text, subject } = sendMailMock.mock.calls[0][0];
    expect(subject.toLowerCase()).toContain("pickup code");
    expect(text.toLowerCase()).not.toContain("around");
  });
});
