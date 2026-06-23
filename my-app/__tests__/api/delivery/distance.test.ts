import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  cookProfiles: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  logAndCheckRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/mapbox-directions", () => ({
  getDrivingDistanceKm: vi.fn(),
}));

vi.mock("@/lib/delivery-fee", () => ({
  calcDeliveryFee: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/delivery/distance/route";
import { db } from "@/db";
import { calcDeliveryFee } from "@/lib/delivery-fee";
import { getDrivingDistanceKm } from "@/lib/mapbox-directions";

// ─── helpers ──────────────────────────────────────────────────────────────────

const COOK_ID = "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/delivery/distance", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    cookId: COOK_ID,
    customerLat: 43.651,
    customerLng: -79.347,
    ...overrides,
  };
}

/** Mock db.select().from().where().limit() chain returning given rows */
function mockDbSelect(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

beforeEach(() => vi.clearAllMocks());

// ─── tests ────────────────────────────────────────────────────────────────────

describe("POST /api/delivery/distance", () => {
  describe("returns free/zero when cook does not self-deliver", () => {
    it("returns {fee:0, isFree:true} when delivery !== 'self'", async () => {
      mockDbSelect([
        {
          delivery: "platform",
          pickupLat: 43.6,
          pickupLng: -79.38,
          maxDeliveryKm: 20,
          deliveryRatePerKm: "1.50",
          deliveryFlatFee: "3.00",
          freeDeliveryAbove: null,
        },
      ]);

      const res = await POST(makePost(validBody()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        fee: 0,
        isFree: true,
        isOutOfRange: false,
        distanceKm: 0,
      });
      expect(getDrivingDistanceKm).not.toHaveBeenCalled();
    });

    it("returns {fee:0, isFree:true} when cook has no pickupLat", async () => {
      mockDbSelect([
        {
          delivery: "self",
          pickupLat: null,
          pickupLng: -79.38,
          maxDeliveryKm: 20,
          deliveryRatePerKm: "1.50",
          deliveryFlatFee: "3.00",
          freeDeliveryAbove: null,
        },
      ]);

      const res = await POST(makePost(validBody()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        fee: 0,
        isFree: true,
        isOutOfRange: false,
        distanceKm: 0,
      });
      expect(getDrivingDistanceKm).not.toHaveBeenCalled();
    });

    it("returns {fee:0, isFree:true} when cook has no pickupLng", async () => {
      mockDbSelect([
        {
          delivery: "self",
          pickupLat: 43.6,
          pickupLng: null,
          maxDeliveryKm: 20,
          deliveryRatePerKm: "1.50",
          deliveryFlatFee: "3.00",
          freeDeliveryAbove: null,
        },
      ]);

      const res = await POST(makePost(validBody()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        fee: 0,
        isFree: true,
        isOutOfRange: false,
        distanceKm: 0,
      });
    });
  });

  describe("calculates delivery fee for self-delivery cooks", () => {
    it("returns calculated fee when cook has valid delivery config", async () => {
      mockDbSelect([
        {
          delivery: "self",
          pickupLat: 43.6,
          pickupLng: -79.38,
          maxDeliveryKm: 20,
          deliveryRatePerKm: "1.50",
          deliveryFlatFee: "3.00",
          freeDeliveryAbove: null,
        },
      ]);
      vi.mocked(getDrivingDistanceKm).mockResolvedValue(8.5);
      vi.mocked(calcDeliveryFee).mockReturnValue({
        fee: 15.75,
        isFree: false,
        isOutOfRange: false,
        distanceKm: 8.5,
      });

      const res = await POST(makePost(validBody()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fee).toBe(15.75);
      expect(body.isFree).toBe(false);
      expect(body.isOutOfRange).toBe(false);
      expect(body.distanceKm).toBe(8.5);
      expect(getDrivingDistanceKm).toHaveBeenCalledWith(
        43.6,
        -79.38,
        43.651,
        -79.347,
      );
    });

    it("returns {isOutOfRange:true} when distance exceeds maxDeliveryKm", async () => {
      mockDbSelect([
        {
          delivery: "self",
          pickupLat: 43.6,
          pickupLng: -79.38,
          maxDeliveryKm: 5,
          deliveryRatePerKm: "1.50",
          deliveryFlatFee: "3.00",
          freeDeliveryAbove: null,
        },
      ]);
      vi.mocked(getDrivingDistanceKm).mockResolvedValue(12.0);
      vi.mocked(calcDeliveryFee).mockReturnValue({
        fee: 0,
        isFree: false,
        isOutOfRange: true,
        distanceKm: 12.0,
      });

      const res = await POST(makePost(validBody()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isOutOfRange).toBe(true);
    });

    it("passes orderSubtotal to calcDeliveryFee when provided", async () => {
      mockDbSelect([
        {
          delivery: "self",
          pickupLat: 43.6,
          pickupLng: -79.38,
          maxDeliveryKm: 20,
          deliveryRatePerKm: "1.50",
          deliveryFlatFee: "0",
          freeDeliveryAbove: "50.00",
        },
      ]);
      vi.mocked(getDrivingDistanceKm).mockResolvedValue(5.0);
      vi.mocked(calcDeliveryFee).mockReturnValue({
        fee: 0,
        isFree: true,
        isOutOfRange: false,
        distanceKm: 5.0,
      });

      const res = await POST(makePost(validBody({ orderSubtotal: 60 })));
      expect(res.status).toBe(200);
      expect(calcDeliveryFee).toHaveBeenCalledWith(expect.any(Object), 5.0, 60);
    });
  });

  describe("validation errors", () => {
    it("returns 400 when cookId is missing", async () => {
      const res = await POST(
        makePost({ customerLat: 43.651, customerLng: -79.347 }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when cookId is not a uuid", async () => {
      const res = await POST(
        makePost({
          cookId: "not-a-uuid",
          customerLat: 43.651,
          customerLng: -79.347,
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when customerLat is out of range", async () => {
      const res = await POST(makePost(validBody({ customerLat: 91 })));
      expect(res.status).toBe(400);
    });

    it("returns 400 when customerLng is out of range", async () => {
      const res = await POST(makePost(validBody({ customerLng: 181 })));
      expect(res.status).toBe(400);
    });

    it("returns 400 when body is not valid JSON", async () => {
      const req = new NextRequest("http://localhost/api/delivery/distance", {
        method: "POST",
        body: "not json {{{",
        headers: { "content-type": "application/json" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("not found and server errors", () => {
    it("returns 404 when cook not found", async () => {
      mockDbSelect([]);

      const res = await POST(makePost(validBody()));
      expect(res.status).toBe(404);
    });

    it("returns 500 when Mapbox call throws", async () => {
      mockDbSelect([
        {
          delivery: "self",
          pickupLat: 43.6,
          pickupLng: -79.38,
          maxDeliveryKm: 20,
          deliveryRatePerKm: "1.50",
          deliveryFlatFee: "3.00",
          freeDeliveryAbove: null,
        },
      ]);
      vi.mocked(getDrivingDistanceKm).mockRejectedValue(
        new Error("Mapbox Directions API error: 500"),
      );

      const res = await POST(makePost(validBody()));
      expect(res.status).toBe(500);
    });
  });
});
