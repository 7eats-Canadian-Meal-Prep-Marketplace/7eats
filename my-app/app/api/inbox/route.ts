import { and, count, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getClientSession, unauthorized } from "@/app/api/_lib/client-auth";
import { db } from "@/db";
import {
  authUser,
  conversations,
  cookProfiles,
  listings,
  messages,
  orders,
} from "@/db/schema";

// ─── GET /api/inbox ───────────────────────────────────────────────────────────
// List all conversations for the authenticated client, sorted by lastMessageAt DESC.
// Includes unread count, last message preview, cook name, and order info.

export async function GET(req: NextRequest) {
  const session = await getClientSession(req.headers);
  if (!session?.user || session.user.role !== "client") return unauthorized();

  const clientId = session.user.id;

  try {
    // Alias authUser for the cook's user row to avoid collision with client join
    const cookUser = authUser;

    const rows = await db
      .select({
        id: conversations.id,
        cookId: conversations.cookId,
        orderId: conversations.orderId,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        cookDisplayName: cookProfiles.displayName,
        cookUserName: cookUser.name,
        cookFirstName: cookUser.firstName,
        orderStatus: orders.status,
        listingTitle: listings.title,
      })
      .from(conversations)
      .leftJoin(cookProfiles, eq(conversations.cookId, cookProfiles.id))
      .leftJoin(cookUser, eq(cookProfiles.userId, cookUser.id))
      .leftJoin(orders, eq(conversations.orderId, orders.id))
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .where(eq(conversations.clientId, clientId))
      .orderBy(desc(conversations.lastMessageAt));

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const conversationIds = rows.map((r) => r.id);

    // Fetch unread counts (messages sent by cook = senderRole 'cook', not yet read by client)
    // and last messages for all conversations in parallel
    const [unreadCounts, lastMessages] = await Promise.all([
      db
        .select({
          conversationId: messages.conversationId,
          unreadCount: count(),
        })
        .from(messages)
        .where(
          and(
            sql`${messages.conversationId} = ANY(ARRAY[${sql.join(
              conversationIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}])`,
            eq(messages.senderRole, "cook"),
            eq(messages.isReadByClient, false),
          ),
        )
        .groupBy(messages.conversationId),

      db
        .select({
          conversationId: messages.conversationId,
          body: messages.body,
          senderRole: messages.senderRole,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          sql`${messages.conversationId} = ANY(ARRAY[${sql.join(
            conversationIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )}])
            AND ${messages.createdAt} = (
              SELECT MAX(m2.created_at)
              FROM messages m2
              WHERE m2.conversation_id = ${messages.conversationId}
            )`,
        ),
    ]);

    // Build lookup maps
    const unreadMap = new Map(
      unreadCounts.map((r) => [r.conversationId, Number(r.unreadCount)]),
    );
    const lastMessageMap = new Map(
      lastMessages.map((r) => [
        r.conversationId,
        { text: r.body, sentAt: r.createdAt?.toISOString() ?? null },
      ]),
    );

    const data = rows.map((row) => ({
      id: row.id,
      cookId: row.cookId,
      cookName: row.cookDisplayName ?? row.cookUserName ?? "",
      cookFirstName: row.cookFirstName ?? null,
      orderId: row.orderId ?? null,
      listingTitle: row.listingTitle ?? null,
      lastMessage: lastMessageMap.get(row.id) ?? null,
      unreadCount: unreadMap.get(row.id) ?? 0,
      orderCompleted: row.orderId
        ? row.orderStatus === "fulfilled" || row.orderStatus === "cancelled"
        : false,
      updatedAt:
        row.lastMessageAt?.toISOString() ?? row.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[inbox GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations." },
      { status: 500 },
    );
  }
}
