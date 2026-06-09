import { describe, expect, it } from "vitest";
import { z } from "zod";

const step2Schema = z.object({
  pickupStreet: z.string().min(1).max(200),
  pickupUnit: z.string().max(50).optional(),
  pickupCity: z.string().min(1).max(100),
  pickupProvince: z.string().length(2),
  pickupPostal: z.string().min(3).max(10),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupPlaceId: z.string().min(1),
  leadTime: z.string(),
  maxCapacity: z.number().int().min(1),
  delivery: z.enum(["none", "self"]),
  acceptsSpecialRequests: z.boolean(),
  pickupWindows: z.record(z.string(), z.any()).optional(),
  pickupDays: z.array(z.string()).optional(),
});

describe("onboarding step2 pickup address schema", () => {
  it("accepts a valid structured address payload", () => {
    const valid = {
      pickupStreet: "123 King St W",
      pickupCity: "Toronto",
      pickupProvince: "ON",
      pickupPostal: "M5H 3T9",
      pickupLat: 43.6483,
      pickupLng: -79.3832,
      pickupPlaceId: "dXJuOm1ieHBsYzpBWmdMWlE",
      leadTime: "1_day",
      maxCapacity: 10,
      delivery: "none",
      acceptsSpecialRequests: false,
    };
    expect(() => step2Schema.parse(valid)).not.toThrow();
  });

  it("rejects payload missing pickupStreet", () => {
    const invalid = {
      pickupCity: "Toronto",
      pickupProvince: "ON",
      pickupPostal: "M5H 3T9",
      pickupLat: 43.6483,
      pickupLng: -79.3832,
      pickupPlaceId: "dXJuOm1ieHBsYzpBWmdMWlE",
      leadTime: "1_day",
      maxCapacity: 10,
      delivery: "none",
      acceptsSpecialRequests: false,
    };
    expect(() => step2Schema.parse(invalid)).toThrow();
  });

  it("rejects payload with invalid province (too long)", () => {
    const invalid = {
      pickupStreet: "123 King St W",
      pickupCity: "Toronto",
      pickupProvince: "Ontario",
      pickupPostal: "M5H 3T9",
      pickupLat: 43.6483,
      pickupLng: -79.3832,
      pickupPlaceId: "dXJuOm1ieHBsYzpBWmdMWlE",
      leadTime: "1_day",
      maxCapacity: 10,
      delivery: "none",
      acceptsSpecialRequests: false,
    };
    expect(() => step2Schema.parse(invalid)).toThrow();
  });
});
