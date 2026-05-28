import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const getSecret = () => {
  const s = process.env.COOKIE_SECRET;
  if (!s) throw new Error("COOKIE_SECRET env var is not set");
  return s;
};

export function generateSignedValue(): string {
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", getSecret()).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

export function verifySignedValue(signed: string): boolean {
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return false;
  const nonce = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", getSecret())
    .update(nonce)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
