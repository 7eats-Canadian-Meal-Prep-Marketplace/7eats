import { and, desc, eq, gte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCookId, unauthorized } from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import {
  authUser,
  cookNotificationReads,
  listings,
  orders,
  reviews,
} from "@/db/schema";
import {
  buildOrderCancelledNotif,
  buildOrderNewNotif,
  buildReviewNotif,
  type Notification,
} from "./_lib";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ORDER_LIMIT = 30;
const REVIEW_LIMIT = 30;

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const since = new Date(Date.now() - WINDOW_MS);

  try {
    const [orderRows, reviewRows, readRows] = await Promise.all([
      db
        .select({
          id: orders.id,
          status: orders.status,
          createdAt: orders.createdAt,
          cancelledAt: orders.cancelledAt,
          listingId: orders.listingId,
          listingTitle: listings.title,
          customerFirstName: authUser.firstName,
          customerLastName: authUser.lastName,
        })
        .from(orders)
        .leftJoin(listings, eq(orders.listingId, listings.id))
        .leftJoin(authUser, eq(orders.clientId, authUser.id))
        .where(and(eq(orders.cookId, cookId), gte(orders.createdAt, since)))
        .orderBy(desc(orders.createdAt))
        .limit(ORDER_LIMIT),

      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          createdAt: reviews.createdAt,
          listingId: reviews.listingId,
          listingTitle: listings.title,
          customerFirstName: authUser.firstName,
          customerLastName: authUser.lastName,
        })
        .from(reviews)
        .leftJoin(listings, eq(reviews.listingId, listings.id))
        .leftJoin(authUser, eq(reviews.clientId, authUser.id))
        .where(and(eq(reviews.cookId, cookId), gte(reviews.createdAt, since)))
        .orderBy(desc(reviews.createdAt))
        .limit(REVIEW_LIMIT),

      db
        .select({
          entityType: cookNotificationReads.entityType,
          entityId: cookNotificationReads.entityId,
        })
        .from(cookNotificationReads)
        .where(eq(cookNotificationReads.cookId, cookId)),
    ]);

    const readSet = new Set(
      readRows.map((r) => `${r.entityType}:${r.entityId}`),
    );

    const notifications: Notification[] = [];

    for (const row of orderRows) {
      notifications.push(
        buildOrderNewNotif(row, readSet.has(`order_new:${row.id}`)),
      );
      if (row.cancelledAt) {
        notifications.push(
          buildOrderCancelledNotif(
            row,
            readSet.has(`order_cancelled:${row.id}`),
          ),
        );
      }
    }

    for (const row of reviewRows) {
      notifications.push(
        buildReviewNotif(row, readSet.has(`review:${row.id}`)),
      );
    }

    notifications.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      data: notifications,
      meta: { unreadCount },
    });
  } catch (err) {
    console.error("[dashboard/notifications GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch notifications." },
      { status: 500 },
    );
  }
}
