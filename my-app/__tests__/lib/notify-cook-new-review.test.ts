import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/lib/emails/review-events", () => ({
  sendNewReviewEmailToCook: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@/db";
import { sendNewReviewEmailToCook } from "@/lib/emails/review-events";
import { notifyCookNewReview } from "@/lib/reviews/notify-cook-new-review";

const REVIEW_ID = "r1r2r3r4-s5s6-7t8u-9v0w-x1y2z3a4b5c6";

function limitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

function joinLimitChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const innerJoin2 = vi.fn(() => ({ where }));
  const innerJoin1 = vi.fn(() => ({ innerJoin: innerJoin2 }));
  const from = vi.fn(() => ({ innerJoin: innerJoin1 }));
  return { from } as never;
}

function whereChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ where }));
  return { from } as never;
}

describe("notifyCookNewReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email when cook review notifications are enabled", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call++;
      if (call === 1) {
        return joinLimitChain([
          {
            rating: 5,
            comment: "Great meal",
            orderId: "order-1",
            clientFirstName: "Jordan",
            clientLastName: "Lee",
            clientEmail: "jordan@example.com",
            cookUserId: "cook-user-1",
            emailNotificationsNewReview: true,
          },
        ]);
      }
      if (call === 2) {
        return limitChain([{ email: "cook@example.com", firstName: "Amara" }]);
      }
      return whereChain([{ dishName: "Jerk Chicken" }]);
    });

    await notifyCookNewReview(REVIEW_ID);

    expect(sendNewReviewEmailToCook).toHaveBeenCalledWith(
      { email: "cook@example.com", firstName: "Amara" },
      {
        customerName: "Jordan Lee",
        orderSummary: "Jerk Chicken",
        rating: 5,
        comment: "Great meal",
      },
    );
  });

  it("skips email when cook review notifications are disabled", async () => {
    vi.mocked(db.select).mockImplementation(() =>
      joinLimitChain([
        {
          rating: 4,
          comment: null,
          orderId: "order-1",
          clientFirstName: "Jordan",
          clientLastName: null,
          clientEmail: "jordan@example.com",
          cookUserId: "cook-user-1",
          emailNotificationsNewReview: false,
        },
      ]),
    );

    await notifyCookNewReview(REVIEW_ID);

    expect(sendNewReviewEmailToCook).not.toHaveBeenCalled();
  });
});
