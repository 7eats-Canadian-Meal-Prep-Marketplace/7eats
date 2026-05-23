import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schemaDir = join(process.cwd(), "db", "schema");

function schemaFile(name: string) {
  return readFileSync(join(schemaDir, name), "utf8");
}

describe("reviewed database schema safeguards", () => {
  it("avoids self-referential admin RLS checks on users", () => {
    const usersSchema = schemaFile("users.ts");

    expect(usersSchema).not.toContain(
      "EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')",
    );
    expect(usersSchema).toContain("auth.jwt() -> 'app_metadata' ->> 'role'");
  });

  it("limits direct order updates to intended order states", () => {
    const ordersSchema = schemaFile("orders.ts");

    expect(ordersSchema).toContain("status IN ('pending', 'cancelled')");
    expect(ordersSchema).toContain(
      "status IN ('pending', 'confirmed', 'ready')",
    );
    expect(ordersSchema).toContain(
      "status IN ('confirmed', 'ready', 'fulfilled', 'cancelled')",
    );
  });

  it("constrains persisted review ratings", () => {
    const ordersSchema = schemaFile("orders.ts");

    expect(ordersSchema).toContain("reviews_rating_range");
    expect(ordersSchema).toContain("BETWEEN 1 AND 5");
  });

  it("declares runtime update timestamps for mutable tables", () => {
    for (const fileName of [
      "users.ts",
      "cooks.ts",
      "listings.ts",
      "orders.ts",
    ]) {
      expect(schemaFile(fileName)).toContain(".$onUpdate(() => new Date())");
    }
  });

  it("keeps waitlist tables protected by Drizzle-managed RLS policies", () => {
    const waitlistSchema = schemaFile("waitlist.ts");

    expect(waitlistSchema).toContain("pgPolicy");
    expect(waitlistSchema).toContain("waitlist_service_only");
    expect(waitlistSchema).toContain("rate_limit_log_service_only");
    expect(waitlistSchema).toContain("auth.role() = 'service_role'");
    expect(waitlistSchema.match(/\.enableRLS\(\)/g)).toHaveLength(2);
  });
});
