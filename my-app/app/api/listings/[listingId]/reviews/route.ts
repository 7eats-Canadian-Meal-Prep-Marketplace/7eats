import { type NextRequest, NextResponse } from "next/server";

// NOTE: The `reviews` table does not yet exist in the schema.
// This route returns an empty list until the reviews schema is added.
// Once the `reviews` table is created and exported from @/db/schema, replace
// this stub with the real query:
//
//   SELECT reviews.*, authUser.firstName, authUser.lastName
//   FROM reviews
//   LEFT JOIN "user" authUser ON reviews.clientId = authUser.id
//   WHERE reviews.listingId = listingId AND reviews.isVisible = true
//   ORDER BY reviews.createdAt DESC
//   LIMIT limit OFFSET offset

type RouteContext = { params: Promise<{ listingId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  // Consume params to satisfy Next.js dynamic route requirements
  await params;

  const urlParams = new URL(req.url).searchParams;

  const rawLimit = Number.parseInt(urlParams.get("limit") ?? "20", 10);
  const limit = Number.isNaN(rawLimit)
    ? 20
    : Math.min(100, Math.max(1, rawLimit));

  const rawOffset = Number.parseInt(urlParams.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

  return NextResponse.json({
    success: true,
    data: [],
    meta: { total: 0, limit, offset },
  });
}
