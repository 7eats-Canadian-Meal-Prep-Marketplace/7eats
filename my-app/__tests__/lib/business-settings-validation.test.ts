import { describe, expect, it } from "vitest";
import { isGeocodedPickupAddress } from "@/lib/address";
import {
  validateAccountSettings,
  validateKitchenSettings,
  validateLogisticsSettings,
} from "@/lib/business-settings-validation";

describe("validateKitchenSettings", () => {
  it("requires kitchen name", () => {
    expect(
      validateKitchenSettings({
        displayName: "",
        bio: "",
        socialLink: "",
      }),
    ).toBe("Kitchen name is required.");
  });

  it("accepts blank website", () => {
    expect(
      validateKitchenSettings({
        displayName: "Test Kitchen",
        bio: "Bio",
        socialLink: "",
      }),
    ).toBeNull();
  });
});

describe("validateAccountSettings", () => {
  it("requires last name", () => {
    expect(
      validateAccountSettings({
        firstName: "Ada",
        lastName: "",
      }),
    ).toBe("Last name is required.");
  });
});

describe("validateLogisticsSettings", () => {
  const base = {
    pickupStreet: "123 Main St",
    pickupCity: "Toronto",
    pickupProvince: "ON",
    pickupPostal: "M5V 2T6",
    pickupLat: 43.65,
    pickupLng: -79.38,
    fulfillment: "pickup" as const,
    pickupDays: ["Mon"],
    pickupWindows: { monday: { from: "11:00", to: "14:00" } },
    deliveryDays: [] as string[],
    deliveryWindows: {},
    dayKey: () => "monday",
    leadTime: "1_day",
    maxCapacity: "50",
    maxDeliveryKm: null,
    deliveryRatePerKm: 0.5,
    freeDeliveryAbove: null,
  };

  it("rejects unresolved address text", () => {
    expect(
      validateLogisticsSettings({
        ...base,
        pickupLat: null,
        pickupLng: null,
      }),
    ).toBe("Select your pickup address from the suggestions.");
  });

  it("accepts valid pickup-only logistics", () => {
    expect(validateLogisticsSettings(base)).toBeNull();
  });

  it("accepts delivery logistics with unset zone (defaults apply)", () => {
    expect(
      validateLogisticsSettings({
        ...base,
        fulfillment: "both",
        deliveryDays: ["Mon"],
        deliveryWindows: { monday: { from: "11:00", to: "14:00" } },
        maxDeliveryKm: null,
        deliveryRatePerKm: 0.5,
      }),
    ).toBeNull();
  });
});

describe("isGeocodedPickupAddress", () => {
  it("requires lat/lng and normalized province", () => {
    expect(
      isGeocodedPickupAddress({
        pickupStreet: "123 Main",
        pickupCity: "Toronto",
        pickupProvince: "Ontario",
        pickupPostal: "M5V 2T6",
        pickupLat: 43.6,
        pickupLng: -79.3,
      }),
    ).toBe(true);
  });
});
