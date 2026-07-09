vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authKvStore: { key: "key", value: "value", expiresAt: "expires_at" },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => ({ and: args })),
  eq: vi.fn((...args) => ({ eq: args })),
  gt: vi.fn((...args) => ({ gt: args })),
  isNull: vi.fn((...args) => ({ isNull: args })),
  or: vi.fn((...args) => ({ or: args })),
  sql: vi.fn((strings) => ({ sql: strings })),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { authSecondaryStorage } from "@/lib/auth-secondary-storage";

describe("authSecondaryStorage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("get", () => {
    it("returns the stored value when a row is found", async () => {
      const limit = vi.fn().mockResolvedValue([{ value: "5" }]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      vi.mocked(db.select).mockReturnValue({ from } as never);

      const result = await authSecondaryStorage.get("rl:sign-in/email:1.2.3.4");

      expect(result).toBe("5");
    });

    it("returns null when no row is found (cache miss or expired)", async () => {
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      vi.mocked(db.select).mockReturnValue({ from } as never);

      const result = await authSecondaryStorage.get("missing-key");

      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("upserts with a null expiresAt when no ttl is given", async () => {
      const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
      const values = vi.fn(() => ({ onConflictDoUpdate }));
      vi.mocked(db.insert).mockReturnValue({ values } as never);

      await authSecondaryStorage.set("key1", "value1");

      expect(values).toHaveBeenCalledWith({
        key: "key1",
        value: "value1",
        expiresAt: null,
      });
      expect(onConflictDoUpdate).toHaveBeenCalledWith({
        target: "key",
        set: { value: "value1", expiresAt: null },
      });
    });

    it("upserts with a computed expiresAt when a ttl is given", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-08T00:00:00.000Z"));

      const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
      const values = vi.fn(() => ({ onConflictDoUpdate }));
      vi.mocked(db.insert).mockReturnValue({ values } as never);

      await authSecondaryStorage.set("key1", "value1", 900);

      expect(values).toHaveBeenCalledWith({
        key: "key1",
        value: "value1",
        expiresAt: new Date("2026-07-08T00:15:00.000Z"),
      });

      vi.useRealTimers();
    });
  });

  describe("delete", () => {
    it("deletes the row by key", async () => {
      const where = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where } as never);

      await authSecondaryStorage.delete("key1");

      expect(db.delete).toHaveBeenCalled();
      expect(where).toHaveBeenCalled();
    });
  });
});
