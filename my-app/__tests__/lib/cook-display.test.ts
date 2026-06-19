import { describe, expect, it } from "vitest";
import {
  cookPersonName,
  kitchenDisplayName,
  shouldShowKitchenSubtitle,
} from "@/lib/cook-display";

describe("cook-display", () => {
  it("prefers cook name for spotlight person label", () => {
    expect(
      cookPersonName({
        cookName: "Maria Garcia",
        displayName: "Mama Olu's Kitchen",
      }),
    ).toBe("Maria Garcia");
  });

  it("falls back to kitchen name when cook name is missing", () => {
    expect(
      cookPersonName({ cookName: null, displayName: "Mama Olu's Kitchen" }),
    ).toBe("Mama Olu's Kitchen");
  });

  it("uses kitchen name for listing cards", () => {
    expect(kitchenDisplayName({ displayName: "Mama Olu's Kitchen" })).toBe(
      "Mama Olu's Kitchen",
    );
  });

  it("hides duplicate kitchen subtitle when names match", () => {
    expect(
      shouldShowKitchenSubtitle({
        cookName: "Maria Garcia",
        displayName: "Maria Garcia",
      }),
    ).toBe(false);
  });
});
