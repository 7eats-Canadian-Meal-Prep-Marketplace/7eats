import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
  listings: {},
  orderDishes: {},
  orderPayments: {
    orderId: "orderId",
    type: "type",
    platformFeePct: "platformFeePct",
    platformFeeAmount: "platformFeeAmount",
    cookPayoutAmount: "cookPayoutAmount",
  },
  orders: {
    id: "id",
    cookId: "cookId",
    createdAt: "createdAt",
    fulfillmentWindowStart: "fulfillmentWindowStart",
    pickupAt: "pickupAt",
  },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => "count"),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/business/dashboard/orders/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const COOK_ID = "cook-uuid";
const USER_ID = "user-uuid";

function makeGet(query: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/business/dashboard/orders?${query}`,
  );
}

function mockSession(userId: string | null) {
  vi.mocked(auth.api.getSession).mockResolvedValue(
    userId ? ({ user: { id: userId, role: "cook" } } as never) : null,
  );
}

function cookChain() {
  const limit = vi.fn().mockResolvedValue([{ id: COOK_ID }]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function ordersListChain(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ offset });
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const leftJoinPayments = vi.fn().mockReturnValue({ where });
  const leftJoinUser = vi.fn().mockReturnValue({ leftJoin: leftJoinPayments });
  const leftJoinListings = vi.fn().mockReturnValue({ leftJoin: leftJoinUser });
  const from = vi.fn().mockReturnValue({ leftJoin: leftJoinListings });
  return { from } as never;
}

function ordersCountChain(total: number) {
  const where = vi.fn().mockResolvedValue([{ total }]);
  const from = vi.fn().mockReturnValue({ where });
  return { from } as never;
}

describe("GET /api/business/dashboard/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession(USER_ID);
  });

  it("rejects limit above 100 (calendar was sending 200)", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      return call === 1 ? cookChain() : ordersListChain([]);
    });

    const res = await GET(
      makeGet("dateFrom=2026-06-22&dateTo=2026-06-28&limit=200"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/100/);
  });

  it("accepts calendar week params with limit=100", async () => {
    const saturdayDelivery = {
      id: "ord-sat",
      status: "confirmed",
      fulfillmentMode: "delivery",
      fulfillmentWindowStart: new Date(2026, 5, 27, 12, 30, 0, 0),
      fulfillmentWindowEnd: new Date(2026, 5, 27, 14, 30, 0, 0),
      pickupAt: null,
      itemCount: 5,
    };

    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) return cookChain();
      if (call === 2) return ordersListChain([saturdayDelivery]);
      return ordersCountChain(1);
    });

    const res = await GET(
      makeGet("dateFrom=2026-06-22&dateTo=2026-06-28&limit=100"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("ord-sat");
  });
});

describe("calendar buildWeekFromData (outlying orders)", () => {
  it("adds a delivery window on a day no longer in logistics when orders exist", async () => {
    const { buildWeekFromData } = await import("@/lib/business-calendar");
    const saturday = new Date(2026, 5, 27, 12, 30, 0, 0);
    const monday = new Date(2026, 5, 22, 0, 0, 0, 0);

    const week = buildWeekFromData(
      monday,
      {
        pickupWindows: [{ day: "saturday", from: "10:00", to: "12:00" }],
        deliveryWindows: [{ day: "friday", from: "11:00", to: "14:00" }],
        offersPickup: true,
        delivery: "self",
      },
      [
        {
          id: "ord-1",
          scheduleDay: "2026-06-27",
          datetime: saturday.toISOString(),
          windowStart: saturday.toISOString(),
          windowEnd: new Date(2026, 5, 27, 14, 30, 0, 0).toISOString(),
          kind: "delivery",
          customerName: "Hendrik",
          listingTitle: "Order",
          quantity: 5,
          pickupCodeVerifiedAt: null,
        },
      ],
    );

    const saturdaySchedule = week.find((d) => d.date.getDay() === 6);
    expect(
      saturdaySchedule?.windows.some((w) => w.window.kind === "delivery"),
    ).toBe(true);
    const deliveryWindow = saturdaySchedule?.windows.find(
      (w) => w.window.kind === "delivery",
    );
    expect(deliveryWindow?.orders).toHaveLength(1);
    expect(deliveryWindow?.window.from).toBe("12:30");
    expect(deliveryWindow?.window.to).toBe("14:30");
  });
});
