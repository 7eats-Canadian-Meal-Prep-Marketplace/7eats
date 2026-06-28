import { describe, expect, it } from "vitest";
import {
  formatUnavailableDishesMessage,
  openOrdersArchiveError,
} from "@/lib/dish-lifecycle-messages";

describe("openOrdersArchiveError", () => {
  it("uses singular copy for one open order", () => {
    expect(openOrdersArchiveError(1)).toContain("1 open order");
  });

  it("uses plural copy for multiple open orders", () => {
    expect(openOrdersArchiveError(3)).toContain("3 open orders");
  });
});

describe("formatUnavailableDishesMessage", () => {
  it("names a paused dish", () => {
    expect(
      formatUnavailableDishesMessage([
        { dishId: "d1", name: "Jollof rice", reason: "paused" },
      ]),
    ).toContain("Jollof rice");
  });

  it("lists multiple paused dishes", () => {
    expect(
      formatUnavailableDishesMessage([
        { dishId: "d1", name: "Jollof rice", reason: "paused" },
        { dishId: "d2", name: "Egusi stew", reason: "paused" },
      ]),
    ).toContain("Jollof rice, Egusi stew");
  });
});
