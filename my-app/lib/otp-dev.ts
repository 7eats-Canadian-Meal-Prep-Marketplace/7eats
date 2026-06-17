// ─── Dev-only OTP bypass ────────────────────────────────────────────────────
//
// Twilio Verify on a trial/free account can only deliver SMS to numbers that
// have been verified in the Twilio console, which makes the phone-verification
// flows impossible to exercise locally. To keep those flows testable without a
// paid plan, we accept a fixed bypass code when NOT in production.
//
// This is hard-gated to `NODE_ENV === "development"` — i.e. only a local
// `next dev` server. It is OFF in production builds (NODE_ENV "production") AND
// under Vitest (NODE_ENV "test"), so the test suite still exercises the real
// (mocked) Twilio Verify path and a deployed build can never bypass OTP.
export const OTP_DEV_BYPASS = process.env.NODE_ENV === "development";

// Code accepted by the bypass. Override with DEV_OTP_CODE if desired.
export const DEV_OTP_CODE = process.env.DEV_OTP_CODE ?? "000000";
