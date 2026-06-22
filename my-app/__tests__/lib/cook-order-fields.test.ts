import { describe, expect, it } from "vitest";
import { resolveOrderCookFields } from "@/lib/orders/cook-order-fields";

describe("resolveOrderCookFields", () => {
  it("prefers kitchen display name and returns media urls", () => {
    expect(
      resolveOrderCookFields({
        cookDisplayName: "The Jamaican Gold Rush",
        cookFirstName: "Maria",
        cookLastName: "Garcia",
        cookPhotoUrl: "https://cdn.example/photo.jpg",
        cookBannerUrl: "https://cdn.example/banner.jpg",
      }),
    ).toEqual({
      cookName: "The Jamaican Gold Rush",
      cookInitials: "TJ",
      cookPhotoUrl: "https://cdn.example/photo.jpg",
      cookBannerUrl: "https://cdn.example/banner.jpg",
    });
  });

  it("falls back to person name and initials", () => {
    expect(
      resolveOrderCookFields({
        cookFirstName: "Maria",
        cookLastName: "Garcia",
      }),
    ).toEqual({
      cookName: "Maria Garcia",
      cookInitials: "MG",
      cookPhotoUrl: null,
      cookBannerUrl: null,
    });
  });
});
