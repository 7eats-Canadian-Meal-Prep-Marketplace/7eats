import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("htmlEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("references a publicly fetchable email-safe logo asset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.resetModules();
    const { htmlEmail } = await import("@/lib/emails/base");

    const html = htmlEmail({
      title: "Test email",
      preheader: "Test preheader",
      bodyHtml: "<p>Body</p>",
    });

    const logoSources = [...html.matchAll(/<img src="([^"]+)"/g)].map(
      ([, src]) => src,
    );

    expect(logoSources).toContain("https://www.7eats.ca/7eats-logo-email.png");

    for (const src of logoSources) {
      const url = new URL(src);
      expect(url.origin).toBe("https://www.7eats.ca");
      expect(url.pathname).not.toMatch(/\.svg$/);
      expect(existsSync(path.join(process.cwd(), "public", url.pathname))).toBe(
        true,
      );
    }
  });
});
