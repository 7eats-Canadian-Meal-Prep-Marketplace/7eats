import { describe, expect, it } from "vitest";
import { setupIntentIdFromClientSecret } from "@/lib/stripe/setup-intent";

describe("setupIntentIdFromClientSecret", () => {
  it("extracts the setup intent id from a client secret", () => {
    expect(setupIntentIdFromClientSecret("seti_123_secret_abc")).toBe(
      "seti_123",
    );
  });
});
