import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { execute: vi.fn() },
}));
// sql is used only as a tagged template here; a passthrough is enough.
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

import { db } from "@/db";
import { searchCooks } from "@/lib/search/query";

describe("searchCooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits on empty query without hitting the DB", async () => {
    const hits = await searchCooks({
      q: "   ",
      lat: 43.6,
      lng: -79.3,
      mode: "pickup",
    });
    expect(hits).toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("maps DB rows into typed hits", async () => {
    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        { cook_id: "a", distance_km: "1.2", score: "1.80" },
        { cook_id: "b", distance_km: null, score: 0.5 },
      ],
    } as never);

    const hits = await searchCooks({
      q: "greek",
      lat: 43.6,
      lng: -79.3,
      mode: "pickup",
    });

    expect(hits).toEqual([
      { cookId: "a", distanceKm: 1.2, score: 1.8 },
      { cookId: "b", distanceKm: null, score: 0.5 },
    ]);
  });

  it("tolerates a missing rows field", async () => {
    vi.mocked(db.execute).mockResolvedValue({} as never);
    const hits = await searchCooks({
      q: "greek",
      lat: 43.6,
      lng: -79.3,
      mode: "delivery",
    });
    expect(hits).toEqual([]);
  });
});
