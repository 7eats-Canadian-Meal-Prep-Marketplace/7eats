import { describe, expect, it } from "vitest";
import {
  buildOrderCancelledNotif,
  buildOrderNewNotif,
  buildReviewNotif,
  parseNotifId,
} from "./_lib";

const ORDER_UUID = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_UUID = "550e8400-e29b-41d4-a716-446655440001";
const LISTING_UUID = "550e8400-e29b-41d4-a716-446655440002";

describe("buildOrderNewNotif", () => {
  it("builds a complete notification for a known order", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z");
    const row = {
      id: ORDER_UUID,
      createdAt,
      cancelledAt: null,
      listingId: LISTING_UUID,
      listingTitle: "Tikka Bowls",
      customerFirstName: "Alice",
      customerLastName: "Smith",
    };
    const notif = buildOrderNewNotif(row, false);
    expect(notif.id).toBe(`order_new:${ORDER_UUID}`);
    expect(notif.kind).toBe("order");
    expect(notif.title).toBe("New order");
    expect(notif.detail).toBe("Alice Smith · Tikka Bowls");
    expect(notif.timestamp).toBe(createdAt.toISOString());
    expect(notif.href).toBe("/business/orders");
    expect(notif.isRead).toBe(false);
    expect(notif.rating).toBeUndefined();
  });

  it("marks isRead correctly when true", () => {
    const row = {
      id: ORDER_UUID,
      createdAt: new Date(),
      cancelledAt: null,
      listingId: null,
      listingTitle: null,
      customerFirstName: "Bob",
      customerLastName: null,
    };
    expect(buildOrderNewNotif(row, true).isRead).toBe(true);
  });

  it("falls back to 'Customer' when both name parts are null", () => {
    const row = {
      id: ORDER_UUID,
      createdAt: new Date(),
      cancelledAt: null,
      listingId: null,
      listingTitle: null,
      customerFirstName: null,
      customerLastName: null,
    };
    expect(buildOrderNewNotif(row, false).detail).toBe("Customer");
  });

  it("omits listing from detail when title is null", () => {
    const row = {
      id: ORDER_UUID,
      createdAt: new Date(),
      cancelledAt: null,
      listingId: LISTING_UUID,
      listingTitle: null,
      customerFirstName: "Carol",
      customerLastName: "White",
    };
    expect(buildOrderNewNotif(row, false).detail).toBe("Carol White");
  });
});

describe("buildOrderCancelledNotif", () => {
  it("uses cancelledAt as the timestamp when present", () => {
    const cancelledAt = new Date("2026-06-02T12:00:00Z");
    const row = {
      id: ORDER_UUID,
      createdAt: new Date("2026-06-01T10:00:00Z"),
      cancelledAt,
      listingId: LISTING_UUID,
      listingTitle: "Bowl",
      customerFirstName: "Bob",
      customerLastName: "Jones",
    };
    const notif = buildOrderCancelledNotif(row, false);
    expect(notif.timestamp).toBe(cancelledAt.toISOString());
    expect(notif.kind).toBe("cancelled");
    expect(notif.title).toBe("Order cancelled");
    expect(notif.id).toBe(`order_cancelled:${ORDER_UUID}`);
    expect(notif.href).toBe("/business/orders");
  });

  it("falls back to createdAt when cancelledAt is null", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z");
    const row = {
      id: ORDER_UUID,
      createdAt,
      cancelledAt: null,
      listingId: null,
      listingTitle: null,
      customerFirstName: null,
      customerLastName: null,
    };
    expect(buildOrderCancelledNotif(row, false).timestamp).toBe(
      createdAt.toISOString(),
    );
  });
});

describe("buildReviewNotif", () => {
  it("builds a review notification with rating and listing href", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z");
    const row = {
      id: REVIEW_UUID,
      rating: 5,
      createdAt,
      listingId: LISTING_UUID,
      listingTitle: "Tikka Bowls",
      customerFirstName: "Carol",
      customerLastName: "White",
    };
    const notif = buildReviewNotif(row, false);
    expect(notif.id).toBe(`review:${REVIEW_UUID}`);
    expect(notif.kind).toBe("review");
    expect(notif.title).toBe("New review");
    expect(notif.detail).toBe("Carol White · Tikka Bowls");
    expect(notif.rating).toBe(5);
    expect(notif.href).toBe(`/business/listings/${LISTING_UUID}`);
    expect(notif.timestamp).toBe(createdAt.toISOString());
  });

  it("handles null listingId in href gracefully", () => {
    const row = {
      id: REVIEW_UUID,
      rating: 3,
      createdAt: new Date(),
      listingId: null,
      listingTitle: null,
      customerFirstName: null,
      customerLastName: null,
    };
    expect(buildReviewNotif(row, false).href).toBe("/business/listings/");
  });
});

describe("parseNotifId", () => {
  it("parses a valid order_new id", () => {
    expect(parseNotifId(`order_new:${ORDER_UUID}`)).toEqual({
      entityType: "order_new",
      entityId: ORDER_UUID,
    });
  });

  it("parses a valid order_cancelled id", () => {
    expect(parseNotifId(`order_cancelled:${ORDER_UUID}`)).toEqual({
      entityType: "order_cancelled",
      entityId: ORDER_UUID,
    });
  });

  it("parses a valid review id", () => {
    expect(parseNotifId(`review:${REVIEW_UUID}`)).toEqual({
      entityType: "review",
      entityId: REVIEW_UUID,
    });
  });

  it("returns null for an unknown entity type", () => {
    expect(parseNotifId(`unknown:${ORDER_UUID}`)).toBeNull();
  });

  it("returns null for an id with no colon", () => {
    expect(parseNotifId("no-colon-here")).toBeNull();
  });

  it("returns null for an invalid UUID", () => {
    expect(parseNotifId("order_new:not-a-valid-uuid")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseNotifId("")).toBeNull();
  });
});
