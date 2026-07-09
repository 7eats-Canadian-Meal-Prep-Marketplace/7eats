import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares two strings in constant time to avoid leaking information via
 * response-time side channels (e.g. an Authorization header check).
 *
 * Both inputs are hashed to fixed-length digests before comparison, so
 * `timingSafeEqual` never sees mismatched buffer lengths and no length-based
 * timing signal about the original strings is exposed either.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
