import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/haversine";

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(43.6532, -79.3832, 43.6532, -79.3832)).toBe(0);
  });

  it("calculates Toronto to Mississauga (~26 km)", () => {
    // Toronto City Hall → Mississauga City Centre
    const dist = haversineKm(43.6532, -79.3832, 43.589, -79.6441);
    expect(dist).toBeGreaterThan(20);
    expect(dist).toBeLessThan(35);
  });

  it("calculates Toronto to Vancouver (~3350 km)", () => {
    const dist = haversineKm(43.6532, -79.3832, 49.2827, -123.1207);
    expect(dist).toBeGreaterThan(3000);
    expect(dist).toBeLessThan(3700);
  });
});
