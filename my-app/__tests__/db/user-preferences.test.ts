import { describe, expect, it } from "vitest";
import { userAddresses } from "@/db/schema";

describe("userAddresses schema", () => {
  it("exports the userAddresses table with correct name", () => {
    expect(userAddresses).toBeDefined();
    // Table name is stored in the internal metadata
    const tableName = (userAddresses as any)[Symbol.for("drizzle:BaseName")];
    expect(tableName).toBe("user_addresses");
  });

  it("has all required address columns", () => {
    expect(userAddresses.id).toBeDefined();
    expect(userAddresses.userId).toBeDefined();
    expect(userAddresses.serviceStreet).toBeDefined();
    expect(userAddresses.serviceUnit).toBeDefined();
    expect(userAddresses.serviceCity).toBeDefined();
    expect(userAddresses.serviceProvince).toBeDefined();
    expect(userAddresses.servicePostal).toBeDefined();
    expect(userAddresses.serviceLat).toBeDefined();
    expect(userAddresses.serviceLng).toBeDefined();
    expect(userAddresses.servicePlaceId).toBeDefined();
    expect(userAddresses.createdAt).toBeDefined();
    expect(userAddresses.updatedAt).toBeDefined();
  });
});
