import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {},
  dbPool: {},
}));

vi.mock("@/db/schema", () => ({
  authUser: {},
  cookPickupWindows: {},
  cookProfiles: {},
  dishes: {},
  dishPromotions: {},
  orderDishes: {},
  orderPayments: {},
  orders: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
}));

vi.mock("@/lib/stripe-payments", () => ({
  cancelPaymentIntent: vi.fn(),
  createCheckoutPaymentIntent: vi.fn(),
}));

vi.mock("@/lib/delivery-fee", () => ({
  calcDeliveryFee: vi.fn(),
}));

vi.mock("@/lib/mapbox-directions", () => ({
  getDrivingDistanceKm: vi.fn(),
}));

import { createOrderBodySchema } from "@/lib/orders/place-order";

describe("createOrderBodySchema", () => {
  it("strips client-supplied pickupAt so the server owns order timing", () => {
    const parsed = createOrderBodySchema.safeParse({
      cookId: "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6",
      dishes: [
        {
          dishId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          quantity: 1,
        },
      ],
      fulfillmentMode: "pickup",
      pickupAt: "2026-06-19T15:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("pickupAt" in parsed.data).toBe(false);
    }
  });
});
