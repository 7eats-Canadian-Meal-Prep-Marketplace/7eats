import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSubsidyMock } = vi.hoisted(() => ({
  createSubsidyMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  orderPayments: {},
  cookProfiles: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));
vi.mock("@/lib/stripe/payments", () => ({
  createCookSubsidyTransfer: createSubsidyMock,
}));

import { db } from "@/db";
import { settleCookSubsidy } from "@/lib/orders/settle-subsidy";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const COOK_ID = "cook-uuid";

/** select chain ending in .limit() -> rows */
function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function mockUpdate() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set };
}

/** Sequences the two selects: 1) order_payments row, 2) cookProfiles account. */
function withRows(
  paymentRow: Record<string, unknown> | null,
  cookRow: Record<string, unknown> | null = { stripeAccountId: "acct_cook" },
) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    call++;
    if (call === 1) return limitChain(paymentRow ? [paymentRow] : []);
    return limitChain(cookRow ? [cookRow] : []);
  });
}

const fullRow = {
  id: "pay-1",
  platformSubsidyAmount: "3.50",
  stripeTopupTransferId: null,
  cookId: COOK_ID,
};

describe("settleCookSubsidy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSubsidyMock.mockResolvedValue("tr_subsidy_1");
  });

  it("transfers the subsidy and stamps the transfer id", async () => {
    withRows(fullRow);
    const { set } = mockUpdate();

    await settleCookSubsidy(ORDER_ID);

    expect(createSubsidyMock).toHaveBeenCalledWith({
      amountCents: 350,
      connectedAccountId: "acct_cook",
      orderId: ORDER_ID,
      idempotencyKey: `subsidy-${ORDER_ID}`,
    });
    expect(set).toHaveBeenCalledWith({ stripeTopupTransferId: "tr_subsidy_1" });
  });

  it("does nothing when there is no full payment row", async () => {
    withRows(null);
    mockUpdate();
    await settleCookSubsidy(ORDER_ID);
    expect(createSubsidyMock).not.toHaveBeenCalled();
  });

  it("does nothing when the subsidy is null", async () => {
    withRows({ ...fullRow, platformSubsidyAmount: null });
    mockUpdate();
    await settleCookSubsidy(ORDER_ID);
    expect(createSubsidyMock).not.toHaveBeenCalled();
  });

  it("does nothing when the subsidy is zero", async () => {
    withRows({ ...fullRow, platformSubsidyAmount: "0.00" });
    mockUpdate();
    await settleCookSubsidy(ORDER_ID);
    expect(createSubsidyMock).not.toHaveBeenCalled();
  });

  it("is idempotent when already settled", async () => {
    withRows({ ...fullRow, stripeTopupTransferId: "tr_existing" });
    mockUpdate();
    await settleCookSubsidy(ORDER_ID);
    expect(createSubsidyMock).not.toHaveBeenCalled();
  });

  it("logs and returns without throwing when the cook has no Stripe account", async () => {
    withRows(fullRow, { stripeAccountId: null });
    mockUpdate();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(settleCookSubsidy(ORDER_ID)).resolves.toBeUndefined();
    expect(createSubsidyMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("swallows transfer failures and leaves the row unstamped for retry", async () => {
    withRows(fullRow);
    const { set } = mockUpdate();
    createSubsidyMock.mockRejectedValueOnce(new Error("insufficient funds"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(settleCookSubsidy(ORDER_ID)).resolves.toBeUndefined();

    expect(createSubsidyMock).toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled(); // not stamped — retryable
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("rounds the subsidy amount to cents", async () => {
    withRows({ ...fullRow, platformSubsidyAmount: "2.357" });
    mockUpdate();
    await settleCookSubsidy(ORDER_ID);
    expect(createSubsidyMock).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 236 }),
    );
  });
});
