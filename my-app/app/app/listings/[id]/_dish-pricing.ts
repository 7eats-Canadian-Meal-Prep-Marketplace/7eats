// Per-dish pricing rules have been moved to listing-level (minUnits, maxUnits,
// priceTiers on MockListing). This file is kept as a stub to avoid breaking
// any residual imports while the cleanup is applied.
export interface DishPricing {
  maxQuantity?: number;
}

export const DISH_PRICING: Record<string, DishPricing> = {};

export function effectivePrice(
  _pricing: DishPricing | undefined,
  basePrice: number,
  _qty: number,
): number {
  return basePrice;
}
