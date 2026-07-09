import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { GET as searchGet } from "@/app/api/search/route";
import { loadCookCards } from "@/lib/cooks/load-cards";
import { logAndCheckRateLimit } from "@/lib/rate-limit";
import { searchCooks } from "@/lib/search/query";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

const VALID_URL = "http://localhost/api/search?q=jollof&lat=43.65&lng=-79.38";

beforeEach(() => vi.clearAllMocks());

// ─── GET /api/search ──────────────────────────────────────────────────────────

describe("GET /api/search", () => {
  it("returns 200 with search results", async () => {
    vi.mocked(searchCooks).mockResolvedValueOnce([
      { cookId: "cook-1", distanceKm: 1.2, score: 0.9 },
    ]);
    vi.mocked(loadCookCards).mockResolvedValueOnce([{ id: "cook-1" } as never]);

    const res = await searchGet(makeReq(VALID_URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("returns 400 when lat/lng are missing", async () => {
    const res = await searchGet(
      makeReq("http://localhost/api/search?q=jollof"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 on search failure", async () => {
    vi.mocked(searchCooks).mockRejectedValueOnce(new Error("db error"));

    const res = await searchGet(makeReq(VALID_URL));
    expect(res.status).toBe(500);
  });

  it("returns 429 when rate limited, without running the search", async () => {
    vi.mocked(logAndCheckRateLimit).mockResolvedValueOnce(false);

    const res = await searchGet(makeReq(VALID_URL));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(searchCooks).not.toHaveBeenCalled();
  });
});
