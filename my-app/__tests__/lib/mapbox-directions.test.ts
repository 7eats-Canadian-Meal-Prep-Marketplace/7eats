import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDrivingDistanceKm } from "@/lib/mapbox-directions";

describe("getDrivingDistanceKm", () => {
  beforeEach(() => {
    vi.stubEnv("MAPBOX_SECRET_TOKEN", "sk.test-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns distance in km from routes[0].distance", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 12345 }] }),
    } as unknown as Response);

    const km = await getDrivingDistanceKm(43.65, -79.38, 43.7, -79.42);
    expect(km).toBeCloseTo(12.345, 2);
  });

  it("throws when no route found", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    } as unknown as Response);

    await expect(
      getDrivingDistanceKm(43.65, -79.38, 43.7, -79.42),
    ).rejects.toThrow("No route found");
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(
      getDrivingDistanceKm(43.65, -79.38, 43.7, -79.42),
    ).rejects.toThrow("401");
  });

  it("throws when token is not set", async () => {
    vi.unstubAllEnvs();
    await expect(
      getDrivingDistanceKm(43.65, -79.38, 43.7, -79.42),
    ).rejects.toThrow("MAPBOX_SECRET_TOKEN");
  });
});
