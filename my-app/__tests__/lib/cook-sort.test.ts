import { describe, expect, it } from "vitest";
import type { BrowseCookCard } from "@/app/app/_cook-card";
import { sortCooks } from "@/lib/cooks/sort";

function cook(overrides: Partial<BrowseCookCard> = {}): BrowseCookCard {
  return {
    id: "1",
    displayName: "Kitchen",
    cookName: null,
    photoUrl: null,
    bannerUrl: null,
    bio: null,
    tags: [],
    niches: [],
    cuisines: [],
    leadTime: null,
    leadTimeCutoff: null,
    delivery: "self",
    offersPickup: true,
    pickupCity: "Toronto",
    rating: null,
    reviewCount: 0,
    ordersCompleted: 0,
    priceFrom: 10,
    representativeDishPhoto: null,
    distanceKm: 5,
    pickupWindows: [],
    deliveryWindows: [],
    ...overrides,
  };
}

describe("sortCooks", () => {
  it("sorts nearest ascending only", () => {
    const list = [
      cook({ id: "a", distanceKm: 12 }),
      cook({ id: "b", distanceKm: 2 }),
      cook({ id: "c", distanceKm: 8 }),
    ];
    expect(sortCooks(list, "nearest", "pickup").map((c) => c.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("combines rating, reviews, and orders for top_rated", () => {
    const list = [
      cook({
        id: "low",
        rating: 4,
        reviewCount: 2,
        ordersCompleted: 1,
      }),
      cook({
        id: "high",
        rating: 4.8,
        reviewCount: 20,
        ordersCompleted: 50,
      }),
      cook({ id: "none", rating: null, reviewCount: 0, ordersCompleted: 99 }),
    ];
    expect(sortCooks(list, "top_rated", "pickup").map((c) => c.id)).toEqual([
      "high",
      "low",
      "none",
    ]);
  });
});
