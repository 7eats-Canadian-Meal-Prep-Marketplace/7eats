import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatEmailFrom, orderSummaryTable } from "@/lib/emails/base";

describe("formatEmailFrom", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to noreply display name", () => {
    expect(formatEmailFrom()).toBe("noreply <noreply@7eats.ca>");
  });

  it("uses team display name for onboarding mail", () => {
    expect(formatEmailFrom("team")).toBe("7eats Team <noreply@7eats.ca>");
  });

  it("respects RESEND_FROM_EMAIL for the mailbox address", () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "mail@7eats.ca");
    expect(formatEmailFrom("noreply")).toBe("noreply <mail@7eats.ca>");
  });
});

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

describe("orderSummaryTable", () => {
  const items = [
    { name: "Butter Chicken", quantity: 2, lineTotal: "24.00" },
    {
      name: "Naan",
      quantity: 3,
      lineTotal: "9.00",
      discountAmount: "1.00",
    },
  ];

  it("itemises each dish with quantity and line total", () => {
    const html = orderSummaryTable({ items, total: "33.00", currency: "CAD" });

    expect(html).toContain("Butter Chicken");
    expect(html).toContain("2&times;");
    expect(html).toContain("$24.00");
    expect(html).toContain("Naan");
    // Per-dish discount is surfaced next to the dish name.
    expect(html).toContain("&minus;$1.00");
  });

  it("renders a subtotal and grand total with the currency", () => {
    const html = orderSummaryTable({ items, total: "33.00", currency: "CAD" });

    expect(html).toContain("Subtotal");
    // Subtotal is summed from line totals: 24 + 9 = 33.
    expect(html).toContain("$33.00");
    expect(html).toContain("Total");
    expect(html).toContain("$33.00 CAD");
  });

  it("only shows delivery and tax rows when they are non-zero", () => {
    const withoutExtras = orderSummaryTable({ items, total: "33.00" });
    expect(withoutExtras).not.toContain("Delivery");
    expect(withoutExtras).not.toContain("Tax");

    const withExtras = orderSummaryTable({
      items,
      deliveryFee: 5,
      tax: 2.5,
      taxLabel: "HST",
      total: "40.50",
    });
    expect(withExtras).toContain("Delivery");
    expect(withExtras).toContain("$5.00");
    expect(withExtras).toContain("HST");
    expect(withExtras).toContain("$2.50");
  });

  it("renders a platform discount as a negative line, between delivery and tax", () => {
    const html = orderSummaryTable({
      items,
      deliveryFee: 5,
      platformDiscount: 4,
      tax: 2.5,
      taxLabel: "HST",
      total: "36.50",
    });
    // The discount is shown as a −$ line so the breakdown reconciles:
    // 33 subtotal + 5 delivery − 4 discount + 2.5 tax = 36.50.
    expect(html).toContain("Discount");
    expect(html).toContain("&minus;$4.00");
    expect(html).toContain("$36.50 CAD");
    // Ordering: discount sits after Delivery and before the tax label.
    const discountIdx = html.indexOf("Discount");
    expect(html.indexOf("Delivery")).toBeLessThan(discountIdx);
    expect(discountIdx).toBeLessThan(html.indexOf("HST"));
  });

  it("omits the discount row when there is no platform discount", () => {
    const html = orderSummaryTable({ items, total: "33.00" });
    expect(html).not.toContain("Discount");
  });

  it("omits the totals block when showTotals is false", () => {
    const html = orderSummaryTable({ items, showTotals: false });
    expect(html).toContain("Butter Chicken");
    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Total");
  });

  it("escapes dish names to prevent markup injection", () => {
    const html = orderSummaryTable({
      items: [{ name: "<script>x</script>", quantity: 1, lineTotal: "1.00" }],
      total: "1.00",
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
