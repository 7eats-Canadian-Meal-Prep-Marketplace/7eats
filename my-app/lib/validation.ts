import type { NextRequest } from "next/server";
import z from "zod";

export const waitlistSchema = z
  .object({
    email: z.email(),
    // Optional service-area city, sent by the in-app out-of-area waitlist CTA.
    city: z.string().trim().max(120).optional(),
  })
  .strict();

export type WaitlistInput = z.infer<typeof waitlistSchema>;

const BOT_PATTERNS = /curl|python-requests|scrapy|wget|libwww/i;

export function guardRequest(req: NextRequest): string | null {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return "Invalid request.";
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_PATTERNS.test(userAgent)) {
    return "Invalid request.";
  }

  return null;
}
