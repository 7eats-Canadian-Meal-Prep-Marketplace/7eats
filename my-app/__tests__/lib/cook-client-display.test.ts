import { describe, expect, it } from "vitest";
import { DELETED_ACCOUNT_DISPLAY_NAME } from "@/lib/client/account-deletion-policy";
import {
  cookClientDisplayName,
  isCookClientDeleted,
  isCookClientGuest,
} from "@/lib/orders/cook-client-display";

describe("cookClientDisplayName", () => {
  it("joins first and last name without duplicating legacy tombstone text", () => {
    expect(
      cookClientDisplayName({
        customerFirstName: "Deleted account",
        customerName: "Deleted account",
      }),
    ).toBe(DELETED_ACCOUNT_DISPLAY_NAME);

    expect(
      cookClientDisplayName({
        customerFirstName: "Sam",
        customerLastName: "Lee",
        customerName: "Sam Lee",
      }),
    ).toBe("Sam Lee");
  });

  it("detects deleted and guest clients", () => {
    expect(
      isCookClientDeleted({
        clientAccountStatus: "deleted",
        customerFirstName: "Sam",
      }),
    ).toBe(true);
    expect(
      isCookClientGuest({ isGuestCheckout: true, clientIsGuestAccount: false }),
    ).toBe(true);
  });
});
