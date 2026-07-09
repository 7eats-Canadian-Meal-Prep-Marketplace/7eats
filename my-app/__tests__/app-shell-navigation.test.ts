import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("app shell navigation", () => {
  it("routes the brand logo to marketplace browse", () => {
    const shell = readFileSync(
      join(process.cwd(), "app", "app", "_shell.tsx"),
      {
        encoding: "utf8",
      },
    );

    expect(shell).toContain(
      '<Link href="/app/browse" className={styles.brandLink}>',
    );
  });
});
