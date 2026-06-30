import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  cookApplications: { contactEmail: "contact_email" },
  authUser: { email: "email", role: "role" },
}));
vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  or: (...args: unknown[]) => ({ or: args }),
}));

import { db } from "@/db";
import {
  cookApplicationConflictMessage,
  findCookApplicationConflict,
} from "@/lib/cook-application-conflicts";

function mockSelectSequence(results: unknown[][]) {
  let i = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const rows = results[i++] ?? [];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from } as never;
  });
}

beforeEach(() => vi.clearAllMocks());

describe("findCookApplicationConflict", () => {
  it("returns application_filed when contact email already applied", async () => {
    mockSelectSequence([[{ id: "app-1" }]]);

    await expect(
      findCookApplicationConflict("jane@mamas.ca", "info@mamas.ca"),
    ).resolves.toEqual({ kind: "application_filed" });
  });

  it("returns cook_account when email belongs to a cook user", async () => {
    mockSelectSequence([[], [{ role: "cook" }]]);

    await expect(
      findCookApplicationConflict("jane@mamas.ca", "info@mamas.ca"),
    ).resolves.toEqual({ kind: "cook_account" });
  });

  it("returns client_account when email belongs to a client user", async () => {
    mockSelectSequence([[], [{ role: "client" }]]);

    await expect(
      findCookApplicationConflict("jane@mamas.ca", "info@mamas.ca"),
    ).resolves.toEqual({ kind: "client_account" });
  });

  it("returns null when no conflict exists", async () => {
    mockSelectSequence([[], []]);

    await expect(
      findCookApplicationConflict("jane@mamas.ca", "info@mamas.ca"),
    ).resolves.toBeNull();
  });
});

describe("cookApplicationConflictMessage", () => {
  it("describes an existing application", () => {
    expect(
      cookApplicationConflictMessage({ kind: "application_filed" }),
    ).toContain("already filed an application");
  });
});
