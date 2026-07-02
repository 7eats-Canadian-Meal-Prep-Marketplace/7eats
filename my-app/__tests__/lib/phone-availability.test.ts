import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  authUser: { id: "id", phone: "phone", role: "role", phoneVerified: "pv" },
}));
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  ne: (col: unknown, val: unknown) => ({ ne: [col, val] }),
}));

import { db } from "@/db";
import {
  isPhoneTakenForRole,
  isUniqueViolation,
  phoneTakenMessage,
} from "@/lib/phone-availability";

function mockSelectResult(rows: Array<{ id: string }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(db.select).mockReturnValue({ from } as never);
  return { from, where, limit };
}

beforeEach(() => vi.clearAllMocks());

describe("isPhoneTakenForRole", () => {
  it("returns true when another same-role account has the verified phone", async () => {
    mockSelectResult([{ id: "other-user" }]);
    expect(await isPhoneTakenForRole("+14165550123", "client", "me")).toBe(
      true,
    );
  });

  it("returns false when no conflicting account exists", async () => {
    mockSelectResult([]);
    expect(await isPhoneTakenForRole("+14165550123", "cook", "me")).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("detects Postgres unique-violation code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects nested Postgres unique-violation codes", () => {
    expect(
      isUniqueViolation({
        message: "Failed query",
        cause: { code: "23505" },
      }),
    ).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe("phoneTakenMessage", () => {
  it("names the conflicting role", () => {
    expect(phoneTakenMessage("cook")).toContain("cook");
    expect(phoneTakenMessage("client")).toContain("client");
  });
});
