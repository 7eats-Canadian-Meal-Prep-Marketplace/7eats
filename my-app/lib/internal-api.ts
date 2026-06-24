import { createHash, timingSafeEqual } from "node:crypto";
import { getClientIp } from "@/lib/request-ip";

export function verifyInternalKey(provided: string): boolean {
  const expected = process.env.INTERNAL_API_KEY ?? "";
  if (!expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Internal admin routes require a valid key and, in production, a client IP on
 * INTERNAL_API_ALLOWLIST (comma-separated). Configure Vercel WAF as well.
 */
export function verifyInternalRequest(req: Request): boolean {
  if (!verifyInternalKey(req.headers.get("x-internal-key") ?? "")) {
    return false;
  }

  const allowlist = process.env.INTERNAL_API_ALLOWLIST?.trim();
  if (!allowlist) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[internal] INTERNAL_API_ALLOWLIST must be set in production",
      );
      return false;
    }
    return true;
  }

  const ip = getClientIp(req);
  const allowed = allowlist
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return allowed.includes(ip);
}
