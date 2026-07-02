import { describe, expect, it } from "vitest";
import { accountDeletedEmailContent } from "@/lib/emails/account-deletion";

describe("accountDeletedEmailContent", () => {
  it("states deletion is permanent with no grace period", () => {
    const { text, html } = accountDeletedEmailContent("Alex");
    expect(text).toContain("permanent");
    expect(text).toContain("no grace period");
    expect(text).not.toContain("30 day");
    expect(html).toContain("permanent");
    expect(html).toContain("no grace period");
  });

  it("uses a plain white email canvas", () => {
    const { html } = accountDeletedEmailContent(null);
    expect(html).toContain("background-color:#ffffff");
    expect(html).not.toContain("#f4f4f4");
  });

  it("does not use em dashes in customer-facing copy", () => {
    const { subject, text, html } = accountDeletedEmailContent("Sam");
    const combined = `${subject}\n${text}\n${html}`;
    expect(combined).not.toMatch(/[—–]/);
  });
});
