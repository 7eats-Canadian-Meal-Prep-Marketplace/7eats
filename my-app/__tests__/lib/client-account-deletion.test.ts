import { describe, expect, it } from "vitest";
import {
  BLOCKING_ORDER_STATUSES,
  DELETED_ACCOUNT_DISPLAY_NAME,
  tombstoneEmail,
} from "@/lib/client-account-deletion-policy";

describe("client-account-deletion helpers", () => {
  it("blocks pending, confirmed, and ready orders only", () => {
    expect(BLOCKING_ORDER_STATUSES).toEqual(["pending", "confirmed", "ready"]);
  });

  it("uses a unique tombstone email per user id", () => {
    expect(tombstoneEmail("user_abc")).toBe(
      "deleted.user_abc@deleted.7eats.internal",
    );
    expect(tombstoneEmail("user_xyz")).not.toBe(tombstoneEmail("user_abc"));
  });

  it("uses a stable cook-facing deleted label", () => {
    expect(DELETED_ACCOUNT_DISPLAY_NAME).toBe("Deleted account");
  });
});
