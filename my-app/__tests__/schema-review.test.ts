import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schemaDir = join(process.cwd(), "db", "schema");

function schemaFile(name: string) {
  return readFileSync(join(schemaDir, name), "utf8");
}

describe("reviewed database schema safeguards", () => {
  it("avoids self-referential admin RLS checks on users", () => {
    // user fields migrated to Better Auth (db/schema/auth.ts); admin RLS
    // safeguard is enforced on the tables that still carry role-gated policies.
    const cooksSchema = schemaFile("cooks.ts");

    expect(cooksSchema).not.toContain(
      "EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')",
    );
    expect(cooksSchema).toContain("auth.role() = 'admin'");
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
    // users.ts is a stub — user fields live in Better Auth's authUser table.
    for (const fileName of ["cooks.ts", "listings.ts", "orders.ts"]) {
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

  it("prevents cooks from self-approving certifications or listings", () => {
    const cooksSchema = schemaFile("cooks.ts");
    const listingsSchema = schemaFile("listings.ts");

    expect(cooksSchema).toContain("status = 'pending_review'");
    expect(cooksSchema).toContain("reviewed_at IS NULL");
    expect(cooksSchema).toContain("reviewed_by IS NULL");
    expect(cooksSchema).toContain("review_notes IS NULL");

    expect(listingsSchema).toContain("status = 'draft'");
    expect(listingsSchema).toContain("reviewed_at IS NULL");
    expect(listingsSchema).toContain("reviewed_by IS NULL");
    expect(listingsSchema).toContain("review_notes IS NULL");
  });

  it("only exposes listing tag rows for active listings", () => {
    const listingsSchema = schemaFile("listings.ts");

    expect(listingsSchema).not.toContain(
      'pgPolicy("listing_tags_select_all", {\n      for: "select",\n      using: sql`TRUE`',
    );
    expect(listingsSchema).toContain(
      "listing_id IN (SELECT id FROM listings WHERE status = 'active')",
    );
  });

  it("validates order insert pricing and review order consistency", () => {
    const ordersSchema = schemaFile("orders.ts");

    expect(ordersSchema).toContain("l.id = orders.listing_id");
    expect(ordersSchema).toContain("l.status = 'active'");
    expect(ordersSchema).toContain("l.cook_id = orders.cook_id");
    expect(ordersSchema).toContain("l.base_price = orders.unit_price");
    expect(ordersSchema).toContain(
      "orders.total_price = orders.unit_price * orders.quantity",
    );

    expect(ordersSchema).toContain("o.id = reviews.order_id");
    expect(ordersSchema).toContain("o.cook_id = reviews.cook_id");
    expect(ordersSchema).toContain("o.listing_id = reviews.listing_id");
  });
});
