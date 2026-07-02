import { type NextRequest, NextResponse } from "next/server";
import { submitToIndexNow } from "@/lib/indexnow";
import { publicUrls } from "@/lib/seo-routes";

/**
 * Re-submit every public route to IndexNow. Trigger manually after a deploy
 * that changes the static pages, or wire it into the daily reconcile cron.
 * Protected with CRON_SECRET (same Bearer pattern as the other internal jobs)
 * so only the operator/scheduler can invoke it.
 *
 *   curl -X GET https://www.7eats.ca/api/indexnow \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const urls = publicUrls();
  await submitToIndexNow(urls);

  return NextResponse.json({
    success: true,
    submitted: urls.length,
    submittedAt: new Date().toISOString(),
  });
}
