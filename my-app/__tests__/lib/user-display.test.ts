import { describe, expect, it } from "vitest";
import { profileDisplayName, profileInitials } from "@/lib/user-display";

describe("profileInitials", () => {
  it("uses first and last name letters", () => {
    expect(profileInitials("Jane", "Doe")).toBe("JD");
  });

  it("uses two letters from a single first name", () => {
    expect(profileInitials("Hunter", null)).toBe("HU");
  });

  it("falls back to account name when names are missing", () => {
    expect(profileInitials(null, null, "John Smith")).toBe("JS");
    expect(profileInitials(null, null, "Cher")).toBe("CH");
  });

  it("derives initials from email local part", () => {
    expect(profileInitials(null, null, "hunter.nelson@example.com")).toBe("HN");
    expect(profileInitials(null, null, "hntnz@gmail.com")).toBe("HN");
  });

  it("returns ? when nothing is available", () => {
    expect(profileInitials(null, null)).toBe("?");
  });
});

describe("profileDisplayName", () => {
  it("joins first and last name", () => {
    expect(profileDisplayName("Jane", "Doe")).toBe("Jane Doe");
  });

  it("falls back to account name", () => {
    expect(profileDisplayName(null, null, "John Smith")).toBe("John Smith");
  });
});
