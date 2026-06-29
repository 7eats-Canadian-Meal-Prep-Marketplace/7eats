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

// Signs an arbitrary string payload (e.g. a JSON blob) so it can be stored in a
// client cookie and trusted on the way back. Format: "<base64url(payload)>.<hmac>".
export function signPayload(payload: string): string {
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

export function readSignedPayload(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", getSecret())
    .update(encoded)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

// Signs an E.164 phone number so stage 2 can verify the number hasn't been swapped.
// Format: "<phone>.<hmac-hex>"
export function generateSignedPhone(phone: string): string {
  const sig = createHmac("sha256", getSecret()).update(phone).digest("hex");
  return `${phone}.${sig}`;
}

export function verifySignedPhone(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;
  const phone = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", getSecret())
    .update(phone)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) return phone;
    return null;
  } catch {
    return null;
  }
}
