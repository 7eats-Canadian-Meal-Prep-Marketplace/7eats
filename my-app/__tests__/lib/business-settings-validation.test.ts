import { describe, expect, it } from "vitest";
import { isGeocodedPickupAddress } from "@/lib/address";
import {
  validateAccountSettings,
  validateKitchenSettings,
  validateLogisticsSettings,
} from "@/lib/business/settings-validation";

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
    maxDeliveryKm: null,
    deliveryRatePerKm: 0.5,
    freeDeliveryAbove: "",
  };

  const bothBase = {
    ...base,
    fulfillment: "both" as const,
    deliveryDays: ["Mon"],
    deliveryWindows: { monday: { from: "11:00", to: "14:00" } },
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
    expect(validateLogisticsSettings(bothBase)).toBeNull();
  });

  it("accepts a well-formed free delivery threshold", () => {
    expect(
      validateLogisticsSettings({ ...bothBase, freeDeliveryAbove: "49.99" }),
    ).toBeNull();
  });

  it("rejects a free delivery threshold with more than two decimals", () => {
    expect(
      validateLogisticsSettings({ ...bothBase, freeDeliveryAbove: "49.999" }),
    ).toBe(
      "Free delivery threshold must be a dollar amount with up to 2 decimals.",
    );
  });

  it("rejects a non-numeric free delivery threshold", () => {
    expect(
      validateLogisticsSettings({ ...bothBase, freeDeliveryAbove: "free" }),
    ).toBe(
      "Free delivery threshold must be a dollar amount with up to 2 decimals.",
    );
  });

  it("rejects a free delivery threshold above the maximum", () => {
    expect(
      validateLogisticsSettings({ ...bothBase, freeDeliveryAbove: "10000" }),
    ).toBe("Free delivery threshold must be $9999.99 or less.");
  });

  it("ignores the free delivery threshold when delivery is off", () => {
    expect(
      validateLogisticsSettings({ ...base, freeDeliveryAbove: "not-a-price" }),
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
