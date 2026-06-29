import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short human-readable confirmation code shown on receipt + e-mail. */
export function generateConfirmationCode(): string {
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return `7E-${body}`;
}

/** Secret URL token — returned once to the client, stored hashed in DB. */
export function generateGuestAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGuestAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function guestAccessTokensMatch(
  token: string,
  storedHash: string,
): boolean {
  const candidate = hashGuestAccessToken(token);
  try {
    return timingSafeEqual(
      Buffer.from(candidate, "hex"),
      Buffer.from(storedHash, "hex"),
    );
  } catch {
    return false;
  }
}

export function guestOrderReceiptUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/app/checkout/guest-confirmation?token=${encodeURIComponent(token)}`;
}

export function guestOrderCancelUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/app/guest/order/cancel?token=${encodeURIComponent(token)}`;
}
