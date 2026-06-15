// Current revision of the 7eats legal policies. Bump this whenever any policy
// materially changes so the acceptance audit trail records which version a
// person agreed to. Keep in sync with the "Last updated" dates on the policy
// pages under app/(terms|cook-terms|privacy|food-safety|refund-policy).
export const LEGAL_VERSION = "2026-06-15";

// Which policies a person agrees to at each entry point. The slugs match the
// route segments under app/, and the visible checkbox copy must reference the
// same documents listed here.
export const CLIENT_SIGNUP_DOCS = ["terms", "privacy"] as const;
export const GUEST_CHECKOUT_DOCS = [
  "terms",
  "privacy",
  "refund-policy",
] as const;
export const COOK_APPLICATION_DOCS = [
  "cook-terms",
  "terms",
  "privacy",
] as const;
