import type { DietaryBadge, MockListing, NicheCategory } from "./_mock";

export type FulfillmentMode = "pickup" | "delivery";

export type ListingPillKind = "deal" | "order" | "niche" | "dietary";

export type ListingPill = {
  key: string;
  label: string;
  kind: ListingPillKind;
};

const NICHE_LABELS: Record<NicheCategory, string> = {
  high_protein: "High protein",
  low_carb: "Low carb",
  muscle_gain: "Muscle gain",
  heart_health: "Heart health",
  weight_loss: "Weight loss",
  balanced: "Balanced",
  comfort_food: "Comfort food",
  kids_friendly: "Kids friendly",
};

const DIETARY_LABELS: Record<DietaryBadge, string> = {
  halal: "Halal",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "nut-free": "Nut-free",
  kosher: "Kosher",
};

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export function orderTypeLabel(orderType: MockListing["orderType"]): string {
  return orderType === "subscription" ? "Subscription" : "Single order";
}

export function nicheLabel(niche: NicheCategory): string {
  return NICHE_LABELS[niche];
}

export function dietaryLabel(badge: DietaryBadge): string {
  return DIETARY_LABELS[badge];
}

export function listingDishPreview(listing: MockListing): string | null {
  if (listing.dishes.length === 0) return null;
  const names = listing.dishes.slice(0, 2).map((d) => d.name);
  return listing.dishes.length > 2
    ? `${names.join(", ")} + ${listing.dishes.length - 2} more`
    : names.join(" · ");
}

export function listingSummaryPreview(
  listing: MockListing,
  maxLen = 110,
): string {
  const text = listing.description.trim();
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 48 ? cut.slice(0, lastSpace) : cut;
  return `${base} [...]`;
}

export function listingDietaryBadge(listing: MockListing): DietaryBadge | null {
  if (listing.dishes.length === 0) return null;
  const counts = new Map<DietaryBadge, number>();
  for (const dish of listing.dishes) {
    for (const badge of dish.badges) {
      counts.set(badge, (counts.get(badge) ?? 0) + 1);
    }
  }
  for (const [badge, count] of counts) {
    if (count === listing.dishes.length) return badge;
  }
  let best: DietaryBadge | null = null;
  let bestCount = 0;
  for (const [badge, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = badge;
    }
  }
  if (best && bestCount >= Math.ceil(listing.dishes.length / 2)) return best;
  return null;
}

export function listingProfilePills(
  listing: MockListing,
  max = 3,
): ListingPill[] {
  const pills: ListingPill[] = [];

  if (listing.deal) {
    pills.push({
      key: "deal",
      label: listing.deal.badge,
      kind: "deal",
    });
  }

  const niche = listing.niches[0];
  if (niche) {
    pills.push({
      key: `niche-${niche}`,
      label: nicheLabel(niche),
      kind: "niche",
    });
  }

  return pills.slice(0, max);
}

export function listingFulfillmentLabel(
  listing: MockListing,
  mode: FulfillmentMode,
): string {
  if (listing.fulfillment === "delivery") return "Delivery";
  if (listing.fulfillment === "pickup") return "Pickup";
  return mode === "delivery" ? "Delivery" : "Pickup";
}

export function scheduleLine(
  listing: MockListing,
  fulfillment: FulfillmentMode,
): {
  orderBy: string;
  receiveOn: string;
  urgency: "urgent" | "soon" | "normal";
} {
  const h = hoursUntil(listing.orderDeadlineIso);
  let orderBy: string;
  let urgency: "urgent" | "soon" | "normal";

  if (h <= 0) {
    orderBy = "Orders closed";
    urgency = "urgent";
  } else if (h < 2) {
    orderBy = `Closes in ${Math.ceil(h)}h`;
    urgency = "urgent";
  } else if (h < 24) {
    orderBy = `Closes in ${Math.ceil(h)}h`;
    urgency = "soon";
  } else {
    orderBy = `Order by ${listing.orderDeadlineShort}`;
    urgency = "normal";
  }

  const receiveOn =
    fulfillment === "delivery"
      ? `Delivers ${listing.pickupDate}`
      : `Pickup ${listing.pickupDate}`;

  return { orderBy, receiveOn, urgency };
}
