import type { BrowseCookCard } from "@/app/app/_cook-card";
import { firstSlotTimestamp } from "@/lib/cook-card-schedule";

export const COOK_SORT_KEYS = [
  "nearest",
  "price_asc",
  "price_desc",
  "top_rated",
  "soonest",
] as const;

export type CookSortKey = (typeof COOK_SORT_KEYS)[number];

export const COOK_SORT_OPTIONS: { value: CookSortKey; label: string }[] = [
  { value: "nearest", label: "Closest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "top_rated", label: "Top rated" },
  { value: "soonest", label: "Available soonest" },
];

export function parseCookSort(value: string | null): CookSortKey {
  if (value && COOK_SORT_KEYS.includes(value as CookSortKey)) {
    return value as CookSortKey;
  }
  return "nearest";
}

function effectiveFulfillment(
  mode: "pickup" | "delivery",
  cook: BrowseCookCard,
): "pickup" | "delivery" {
  const canDeliver = cook.delivery === "self";
  const canPickup = cook.offersPickup !== false;
  if (mode === "delivery" && canDeliver) return "delivery";
  if (mode === "pickup" && canPickup) return "pickup";
  if (canPickup) return "pickup";
  if (canDeliver) return "delivery";
  return mode;
}

export function sortCooks(
  cooks: BrowseCookCard[],
  sort: CookSortKey,
  fulfillmentMode: "pickup" | "delivery",
): BrowseCookCard[] {
  const list = [...cooks];

  switch (sort) {
    case "nearest":
      return list.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY),
      );

    case "price_asc":
      return list.sort((a, b) => {
        const pa = a.priceFrom ?? Number.POSITIVE_INFINITY;
        const pb = b.priceFrom ?? Number.POSITIVE_INFINITY;
        return pa - pb;
      });

    case "price_desc":
      return list.sort((a, b) => {
        const pa = a.priceFrom ?? Number.NEGATIVE_INFINITY;
        const pb = b.priceFrom ?? Number.NEGATIVE_INFINITY;
        return pb - pa;
      });

    case "top_rated":
      return list.sort((a, b) => {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        if (rb !== ra) return rb - ra;
        if (b.reviewCount !== a.reviewCount) {
          return b.reviewCount - a.reviewCount;
        }
        return b.ordersCompleted - a.ordersCompleted;
      });

    case "soonest":
      return list.sort((a, b) => {
        const modeA = effectiveFulfillment(fulfillmentMode, a);
        const modeB = effectiveFulfillment(fulfillmentMode, b);
        const ta =
          firstSlotTimestamp(
            modeA,
            a.pickupWindows,
            a.deliveryWindows,
            a.leadTime,
          ) ?? Number.POSITIVE_INFINITY;
        const tb =
          firstSlotTimestamp(
            modeB,
            b.pickupWindows,
            b.deliveryWindows,
            b.leadTime,
          ) ?? Number.POSITIVE_INFINITY;
        return ta - tb;
      });

    default:
      return list;
  }
}
