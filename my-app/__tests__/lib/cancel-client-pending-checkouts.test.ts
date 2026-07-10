import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/db/schema", () => ({
  orderPayments: {
    orderId: "orderId",
    type: "type",
    status: "status",
    stripePaymentIntentId: "stripePaymentIntentId",
  },
  orders: { id: "id", clientId: "clientId", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a, b) => ({ a, b })),
}));

import { db } from "@/db";
import * as abandonedCheckout from "@/lib/orders/abandoned-checkout";

function selectWhereResolveChain(final: unknown) {
  const where = vi.fn().mockResolvedValue(final);
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  return { from };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("findClientPendingCheckoutOrderIds", () => {
  it("returns pending checkout ids for a client", async () => {
    vi.mocked(db.select).mockImplementation(
      () =>
        selectWhereResolveChain([
          { orderId: "order-1" },
          { orderId: "order-2" },
        ]) as never,
    );

    await expect(
      abandonedCheckout.findClientPendingCheckoutOrderIds("client-1"),
    ).resolves.toEqual(["order-1", "order-2"]);
  });
});
