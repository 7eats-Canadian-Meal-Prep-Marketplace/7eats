import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("exports userAddresses table", () => {
  const schemaFile = readFileSync(
    join(process.cwd(), "db", "schema", "user-preferences.ts"),
    "utf8",
  );

  expect(schemaFile).toContain("export const userAddresses");
  expect(schemaFile).toContain('"user_addresses"');
});
