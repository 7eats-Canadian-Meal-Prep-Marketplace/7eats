import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  authUser: {},
  cookProfiles: {},
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/** Pulls the nonce value out of the `script-src` directive of a CSP header. */
function extractScriptSrcNonce(csp: string): string | null {
  const scriptSrc = csp
    .split(";")
    .find((d) => d.trim().startsWith("script-src"));
  const match = scriptSrc?.match(/'nonce-([^']+)'/);
  return match?.[1] ?? null;
}

describe("proxy CSP nonce", () => {
  it("sets a Content-Security-Policy header with a nonce in script-src and no 'unsafe-inline'", async () => {
    const req = new NextRequest("http://localhost/terms");
    const res = await proxy(req);

    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();

    const scriptSrc = csp
      ?.split(";")
      .find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toContain("'nonce-");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("keeps 'unsafe-inline' in style-src (Calendly/Google Fonts inline styles, low-risk surface)", async () => {
    const req = new NextRequest("http://localhost/terms");
    const res = await proxy(req);

    const csp = res.headers.get("Content-Security-Policy");
    const styleSrc = csp
      ?.split(";")
      .find((d) => d.trim().startsWith("style-src"));
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("forwards the same nonce to the request via the x-nonce header so Server Components can read it", async () => {
    const req = new NextRequest("http://localhost/terms");
    const res = await proxy(req);

    const csp = res.headers.get("Content-Security-Policy");
    const nonceFromCsp = extractScriptSrcNonce(csp ?? "");
    const nonceFromRequestHeader = res.headers.get(
      "x-middleware-request-x-nonce",
    );

    expect(nonceFromCsp).toBeTruthy();
    expect(nonceFromRequestHeader).toBe(nonceFromCsp);
  });

  it("generates a fresh nonce on every request", async () => {
    const res1 = await proxy(new NextRequest("http://localhost/terms"));
    const res2 = await proxy(new NextRequest("http://localhost/terms"));

    const nonce1 = extractScriptSrcNonce(
      res1.headers.get("Content-Security-Policy") ?? "",
    );
    const nonce2 = extractScriptSrcNonce(
      res2.headers.get("Content-Security-Policy") ?? "",
    );

    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);
  });
});
