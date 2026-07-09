import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { execute: vi.fn().mockResolvedValue({ rows: [] }) },
}));

vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/search/query", () => ({
  searchCooks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/cooks/load-cards", () => ({
  loadCookCards: vi.fn().mockResolvedValue([]),
}));

import { NextRequest } from "next/server";
import { GET as suggestGet } from "@/app/api/search/suggest/route";
import { db } from "@/db";
import { logAndCheckRateLimit } from "@/lib/rate-limit";
import { searchCooks } from "@/lib/search/query";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

const VALID_URL =
  "http://localhost/api/search/suggest?q=jollof&lat=43.65&lng=-79.38";

beforeEach(() => vi.clearAllMocks());

// ─── GET /api/search/suggest ──────────────────────────────────────────────────

describe("GET /api/search/suggest", () => {
  it("returns 200 with terms and kitchens", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ label: "Nigerian" }],
    } as never);
    vi.mocked(searchCooks).mockResolvedValueOnce([
      { cookId: "cook-1", distanceKm: 1.2, score: 0.9 },
    ]);

    const res = await suggestGet(makeReq(VALID_URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.terms).toEqual(["Nigerian"]);
  });

  it("returns 400 when lat/lng are missing", async () => {
    const res = await suggestGet(
      makeReq("http://localhost/api/search/suggest?q=jollof"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 on failure", async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("db error"));

    const res = await suggestGet(makeReq(VALID_URL));
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limited, without querying the db", async () => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValueOnce(false);

    const res = await suggestGet(makeReq(VALID_URL));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
