import { describe, expect, it } from "vitest";
import { userServiceAddress } from "@/db/schema";

describe("userServiceAddress schema", () => {
  it("exports userServiceAddress table", () => {
    expect(userServiceAddress).toBeDefined();

    // Get the table name via the Drizzle symbol
    const baseName = Object.getOwnPropertySymbols(userServiceAddress).find(
      (s) => s.toString().includes("BaseName"),
    );
    expect(baseName).toBeDefined();
    if (baseName) {
      expect(userServiceAddress[baseName]).toBe("user_service_address");
    }
  });

  it("has all required columns", () => {
    const columns = Object.keys(userServiceAddress);
    expect(columns).toContain("id");
    expect(columns).toContain("userId");
    expect(columns).toContain("serviceStreet");
    expect(columns).toContain("serviceCity");
    expect(columns).toContain("serviceProvince");
    expect(columns).toContain("servicePostal");
    expect(columns).toContain("serviceLat");
    expect(columns).toContain("serviceLng");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });
});
