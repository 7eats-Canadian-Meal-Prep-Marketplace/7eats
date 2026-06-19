import { formatAddressLine, isGeocodedPickupAddress } from "@/lib/address";
import {
  DELIVERY_MAX_KM_MAX,
  DELIVERY_MAX_KM_MIN,
  DELIVERY_RATE_MAX,
  DELIVERY_RATE_MIN,
  withDeliveryDefaults,
} from "@/lib/delivery-pricing";
import { isValidOptionalUrl } from "@/lib/url";

export { formatAddressLine as formatAddressQuery };

export function validateKitchenSettings(input: {
  displayName: string;
  bio: string;
  socialLink: string;
}): string | null {
  if (!input.displayName.trim()) {
    return "Kitchen name is required.";
  }
  if (input.displayName.trim().length > 100) {
    return "Kitchen name must be 100 characters or fewer.";
  }
  if (input.bio.length > 500) {
    return "Bio must be 500 characters or fewer.";
  }
  if (!isValidOptionalUrl(input.socialLink)) {
    return "Enter a valid website URL, or leave it blank.";
  }
  return null;
}

export function validateAccountSettings(input: {
  firstName: string;
  lastName: string;
}): string | null {
  if (!input.firstName.trim()) {
    return "First name is required.";
  }
  if (!input.lastName.trim()) {
    return "Last name is required.";
  }
  return null;
}

type DayWindow = { from: string; to: string };

export function validateLogisticsSettings(input: {
  pickupStreet: string;
  pickupCity: string;
  pickupProvince: string;
  pickupPostal: string;
  pickupLat: number | null;
  pickupLng: number | null;
  fulfillment: "pickup" | "delivery" | "both";
  pickupDays: string[];
  pickupWindows: Record<string, DayWindow>;
  deliveryDays: string[];
  deliveryWindows: Record<string, DayWindow>;
  dayKey: (shortDay: string) => string;
  leadTime: string;
  maxCapacity: string;
  maxDeliveryKm: number | null;
  deliveryRatePerKm: number;
  freeDeliveryAbove: number | null;
}): string | null {
  if (!isGeocodedPickupAddress(input)) {
    if (input.pickupStreet.trim()) {
      return "Select your pickup address from the suggestions.";
    }
    return "Pickup address is required. Select it from the suggestions.";
  }

  const offersPickup = input.fulfillment !== "delivery";
  const offersDelivery = input.fulfillment !== "pickup";

  if (offersPickup && input.pickupDays.length === 0) {
    return "Add at least one pickup day.";
  }
  if (offersDelivery && input.deliveryDays.length === 0) {
    return "Add at least one delivery day.";
  }

  const windowError = validateDayWindows(
    offersPickup ? input.pickupDays : [],
    offersPickup ? input.pickupWindows : {},
    input.dayKey,
    "pickup",
  );
  if (windowError) return windowError;

  const deliveryWindowError = validateDayWindows(
    offersDelivery ? input.deliveryDays : [],
    offersDelivery ? input.deliveryWindows : {},
    input.dayKey,
    "delivery",
  );
  if (deliveryWindowError) return deliveryWindowError;

  if (!input.leadTime) {
    return "Select an order lead time.";
  }

  if (input.maxCapacity.trim() !== "") {
    const maxCapacity = Number(input.maxCapacity);
    if (!Number.isInteger(maxCapacity) || maxCapacity < 1) {
      return "Max weekly plates must be a whole number of at least 1.";
    }
  }

  if (offersDelivery) {
    const zone = withDeliveryDefaults({
      maxDeliveryKm: input.maxDeliveryKm,
      deliveryRatePerKm: input.deliveryRatePerKm,
    });
    const maxDeliveryKm = zone.maxDeliveryKm!;
    const deliveryRatePerKm = Number(zone.deliveryRatePerKm);

    if (
      !Number.isInteger(maxDeliveryKm) ||
      maxDeliveryKm < DELIVERY_MAX_KM_MIN ||
      maxDeliveryKm > DELIVERY_MAX_KM_MAX
    ) {
      return `Max delivery distance must be between ${DELIVERY_MAX_KM_MIN} and ${DELIVERY_MAX_KM_MAX} km.`;
    }
    if (
      deliveryRatePerKm < DELIVERY_RATE_MIN ||
      deliveryRatePerKm > DELIVERY_RATE_MAX
    ) {
      return `Delivery rate must be between $${DELIVERY_RATE_MIN.toFixed(2)} and $${DELIVERY_RATE_MAX.toFixed(2)} per km.`;
    }
    if (
      input.freeDeliveryAbove != null &&
      (!Number.isFinite(input.freeDeliveryAbove) || input.freeDeliveryAbove < 0)
    ) {
      return "Free delivery threshold must be zero or greater.";
    }
  }

  return null;
}

function validateDayWindows(
  days: string[],
  windows: Record<string, DayWindow>,
  dayKey: (shortDay: string) => string,
  kind: "pickup" | "delivery",
): string | null {
  for (const day of days) {
    const win = windows[dayKey(day)];
    if (!win?.from || !win?.to) {
      return `Set ${kind} hours for every selected day.`;
    }
    if (win.to <= win.from) {
      return `${kind === "pickup" ? "Pickup" : "Delivery"} end time must be after the start time.`;
    }
  }
  return null;
}

export function validateOrderRules(input: {
  minOrderQty: string;
  maxOrderQty: string;
}): string | null {
  const min = Number(input.minOrderQty);
  const max = input.maxOrderQty === "" ? null : Number(input.maxOrderQty);
  if (!Number.isInteger(min) || min < 1) {
    return "Minimum order must be a whole number of at least 1.";
  }
  if (max != null && (!Number.isInteger(max) || max < min)) {
    return "Maximum order must be a whole number at least the minimum.";
  }
  return null;
}
