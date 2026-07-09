import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function appFile(...segments: string[]) {
  return readFileSync(join(process.cwd(), "app", ...segments), "utf8");
}

describe("app landing navigation", () => {
  it("redirects signed-in clients from /app to browse before rendering", () => {
    const page = appFile("app", "page.tsx");

    expect(page).toContain('import { redirect } from "next/navigation";');
    expect(page).toContain('redirect("/app/browse");');
  });

  it("routes returning guests with a saved address from /app to browse", () => {
    const landing = appFile("components", "MarketplaceLanding", "index.tsx");

    expect(landing).toContain("guest.hydrated");
    expect(landing).toContain("guest.addresses.length > 0");
    expect(landing).toContain('router.replace("/app/browse");');
  });

  it("persists a guest-address cookie marker for server redirects", () => {
    const hook = readFileSync(
      join(process.cwd(), "lib", "hooks", "use-guest-address.tsx"),
      "utf8",
    );

    expect(hook).toContain("GUEST_ADDRESS_COOKIE");
    expect(hook).toContain("document.cookie");
  });
});
