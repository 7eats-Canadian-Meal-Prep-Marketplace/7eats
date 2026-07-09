import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelPiMock, refundPiMock, captureMock, lockMock, settleSubsidyMock } =
  vi.hoisted(() => ({
    cancelPiMock: vi.fn().mockResolvedValue(undefined),
    refundPiMock: vi.fn().mockResolvedValue("re_test"),
    captureMock: vi.fn().mockResolvedValue(undefined),
    lockMock: vi.fn().mockResolvedValue(undefined),
    settleSubsidyMock: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
  dbPool: { transaction: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orderPayments: {},
  orders: {},
  authUser: {},
  cookProfiles: {},
  orderDishes: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));
vi.mock("@/lib/stripe/payments", () => ({
  cancelPaymentIntent: cancelPiMock,
  refundPaymentIntent: refundPiMock,
  capturePaymentIntent: captureMock,
  reverseCookSubsidyTransfer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/orders/settle-subsidy", () => ({
  settleCookSubsidy: settleSubsidyMock,
}));
vi.mock("@/lib/orders/order-lock", () => ({
  acquireOrderStatusLock: lockMock,
}));
vi.mock("@/lib/emails/order-events", () => ({
  sendOrderCancelledByClientEmailToCook: vi.fn().mockResolvedValue(undefined),
  sendOrderCancelledByClientEmailToClient: vi.fn().mockResolvedValue(undefined),
}));

import { db, dbPool } from "@/db";
import { cancelClientOrder } from "@/lib/orders/cancel-order";

const ORDER_ID = "c3d4e5f6-a7b8-4c9d-8e1f-a2b3c4d5e6f7";
const FUTURE = new Date(Date.now() + 7 * 86400_000);

/** Query-shape-agnostic chain resolving to `rows` when awaited. */
function chain(rows: unknown[]) {
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(rows);
      }
      return () => proxy;
    },
  });
  return proxy as never;
}
function selectQueue(results: unknown[][]) {
  let i = 0;
  return () => chain(results[i++] ?? []);
}

function orderRow(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    clientId: "user-1",
    cookId: "cook-1",
    status: "pending",
    totalPrice: "30.00",
    currency: "CAD",
    pickupAt: FUTURE,
    fulfillmentWindowStart: null,
    fulfillmentMode: "pickup",
    cancellationAllowed: true,
    cookLeadTime: null,
    ...over,
  };
}

const COOK_USER_ROW = [
  { cookEmail: "k@t.com", cookFirstName: "K", cookDisplayName: "Kitchen" },
];
const CLIENT_USER_ROW = [{ firstName: "C", lastName: "D", email: "c@t.com" }];
const DISH_ROWS = [{ dishName: "Soup", quantity: 1 }];

describe("cancelClientOrder locking", () => {
  let txSelectQueue: unknown[][];
  let txSelectIndex: number;
  let txSelectSpy: ReturnType<typeof vi.fn>;
  let txUpdateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    txSelectQueue = [];
    txSelectIndex = 0;

    txSelectSpy = vi.fn(() => chain(txSelectQueue[txSelectIndex++] ?? []));
    txUpdateSpy = vi.fn(() => chain([{}]));

    vi.mocked(dbPool.transaction).mockImplementation(async (fn) =>
      fn({ select: txSelectSpy, update: txUpdateSpy } as never),
    );
  });

  it("acquires the advisory lock before re-reading the order's status", async () => {
    vi.mocked(db.select).mockImplementation(selectQueue([[orderRow()]]));
    txSelectQueue = [[orderRow({ status: "pending" })]];

    await cancelClientOrder(ORDER_ID, "user-1", "user-1");

    expect(lockMock).toHaveBeenCalledOnce();
    expect(lockMock.mock.invocationCallOrder[0]).toBeLessThan(
      txSelectSpy.mock.invocationCallOrder[0],
    );
  });

  it("rejects when a concurrent cook update made the order non-cancellable under the lock", async () => {
    // Caller's stale fetch still says "pending" (cancellable), but the
    // fresh re-read under the lock shows the cook already marked it ready.
    vi.mocked(db.select).mockImplementation(
      selectQueue([[orderRow({ status: "pending" })]]),
    );
    txSelectQueue = [[orderRow({ status: "ready" })]];

    const result = await cancelClientOrder(ORDER_ID, "user-1", "user-1");

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Order cannot be cancelled at this stage.",
    });
    expect(cancelPiMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
    expect(refundPiMock).not.toHaveBeenCalled();
    // The transaction bailed before the final status write.
    expect(txUpdateSpy).not.toHaveBeenCalled();
  });

  it("refunds using the freshly re-read status when still cancellable", async () => {
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [orderRow({ status: "pending" })],
        COOK_USER_ROW,
        CLIENT_USER_ROW,
        DISH_ROWS,
      ]),
    );
    txSelectQueue = [
      [orderRow({ status: "pending" })],
      [{ id: "p1", status: "authorized", stripePaymentIntentId: "pi_1" }],
    ];

    const result = await cancelClientOrder(ORDER_ID, "user-1", "user-1");

    expect(result).toEqual({ ok: true, refunded: true });
    expect(cancelPiMock).toHaveBeenCalledOnce();
    expect(captureMock).not.toHaveBeenCalled();
    // Payment status update + final order status update both ran on `tx`.
    expect(txUpdateSpy).toHaveBeenCalledTimes(2);
  });

  it("captures (no refund) when the freshly re-read state is no longer refund-eligible", async () => {
    vi.mocked(db.select).mockImplementation(
      selectQueue([
        [orderRow({ status: "confirmed", cancellationAllowed: false })],
        COOK_USER_ROW,
        CLIENT_USER_ROW,
        DISH_ROWS,
      ]),
    );
    txSelectQueue = [
      [orderRow({ status: "confirmed", cancellationAllowed: false })],
      [
        {
          id: "p1",
          type: "full",
          status: "authorized",
          stripePaymentIntentId: "pi_1",
        },
      ],
    ];

    const result = await cancelClientOrder(ORDER_ID, "user-1", "user-1");

    expect(result).toEqual({ ok: true, refunded: false });
    expect(captureMock).toHaveBeenCalledOnce();
    expect(cancelPiMock).not.toHaveBeenCalled();
    expect(settleSubsidyMock).toHaveBeenCalledOnce();
  });
});
