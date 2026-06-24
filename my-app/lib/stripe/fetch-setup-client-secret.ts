"use client";

let inflightSetupSecret: Promise<string> | null = null;

export async function fetchSetupClientSecret(): Promise<string> {
  if (!inflightSetupSecret) {
    inflightSetupSecret = (async () => {
      const res = await fetch("/api/checkout/setup-intent", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        clientSecret?: string;
        error?: string;
      };
      if (!res.ok || !json.clientSecret) {
        throw new Error(json.error ?? "Could not start secure card setup.");
      }
      return json.clientSecret;
    })().finally(() => {
      inflightSetupSecret = null;
    });
  }
  return inflightSetupSecret;
}

export async function verifySetupIntentOnServer(
  clientSecret: string,
): Promise<boolean> {
  const res = await fetch("/api/checkout/setup-intent/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientSecret }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    succeeded?: boolean;
  };
  return res.ok && json.succeeded === true;
}
