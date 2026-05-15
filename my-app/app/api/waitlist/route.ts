import { type NextRequest, NextResponse } from "next/server";
import { hashIp } from "@/lib/hash";
import { logAndCheckRateLimit } from "@/lib/rate-limit";
import { guardRequest, waitlistSchema } from "@/lib/validation";
import { addToWaitlist } from "@/lib/waitlist";

const MAX_BODY_BYTES = 1024;

function ok(message: string): NextResponse {
  return NextResponse.json({ success: true, message }, { status: 200 });
}

function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const guardError = guardRequest(req);
    if (guardError) return fail(guardError, 400);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ipHash = hashIp(ip);

    const allowed = await logAndCheckRateLimit(ipHash);
    if (!allowed) return fail("Too many attempts. Try again later.", 429);

    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return fail("Invalid request.", 400);
    }

    if (rawBody.length > MAX_BODY_BYTES) return fail("Invalid request.", 400);

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("Invalid request.", 400);
    }

    const parsed = waitlistSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid request.", 400);

    await addToWaitlist(parsed.data.email, ipHash);

    return ok("You're on the list!");
  } catch (err) {
    console.error("[waitlist] Unhandled error:", err);
    return fail("Something went wrong.", 500);
  }
}
