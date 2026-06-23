import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

import { sendMail } from "@/lib/email";
import { sendNewReviewEmailToCook } from "@/lib/emails/review-events";

describe("sendNewReviewEmailToCook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://www.7eats.ca";
  });

  it("sends a formatted review email without a solid red background block", async () => {
    await sendNewReviewEmailToCook(
      { email: "cook@example.com", firstName: "Amara" },
      {
        customerName: "Jordan Lee",
        orderSummary: "Jerk Chicken, Rice & Peas",
        rating: 5,
        comment: "Absolutely delicious.",
      },
    );

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendMail).mock.calls[0][0];
    expect(call.to).toBe("cook@example.com");
    expect(call.subject).toContain("5-star review");
    expect(call.html).toContain("Jordan Lee");
    expect(call.html).toContain("Jerk Chicken, Rice &amp; Peas");
    expect(call.html).toContain("Absolutely delicious.");
    expect(call.html).toContain("background-color:#ffffff");
    expect(call.text).toContain("★★★★★ (5/5)");
  });

  it("omits the comment block when there is no comment", async () => {
    await sendNewReviewEmailToCook(
      { email: "cook@example.com", firstName: null },
      {
        customerName: "Jordan Lee",
        orderSummary: "Tikka Bowls",
        rating: 4,
        comment: null,
      },
    );

    const call = vi.mocked(sendMail).mock.calls[0][0];
    expect(call.html).not.toContain("What they said");
    expect(call.text).not.toContain("Comment:");
  });
});
