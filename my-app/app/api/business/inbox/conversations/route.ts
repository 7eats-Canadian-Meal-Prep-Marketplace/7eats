import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import {
  authUser,
  conversations,
  listings,
  messages,
  orders,
} from "@/db/schema";

// ─── GET /api/business/inbox/conversations ────────────────────────────────────
// List all conversations for the authenticated cook, sorted by lastMessageAt DESC.
// Includes unread count, last message preview, client name, and order info.

export async function GET(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  try {
    // Fetch all conversations for this cook with joined client + order info
    const rows = await db
      .select({
        id: conversations.id,
        clientId: conversations.clientId,
        orderId: conversations.orderId,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        clientName: authUser.name,
        clientFirstName: authUser.firstName,
        clientLastName: authUser.lastName,
        // Order info
        orderStatus: orders.status,
        orderQuantity: orders.quantity,
        orderTotalPrice: orders.totalPrice,
        orderPickupAt: orders.pickupAt,
        listingTitle: listings.title,
      })
      .from(conversations)
      .leftJoin(authUser, eq(conversations.clientId, authUser.id))
      .leftJoin(orders, eq(conversations.orderId, orders.id))
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .where(eq(conversations.cookId, cookId))
      .orderBy(desc(conversations.lastMessageAt));

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const conversationIds = rows.map((r) => r.id);

    // Fetch unread counts and last messages for all conversations in parallel
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
            eq(messages.isReadByCook, false),
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
        )
        .orderBy(asc(messages.createdAt)),
    ]);

    // Build lookup maps
    const unreadMap = new Map(
      unreadCounts.map((r) => [r.conversationId, Number(r.unreadCount)]),
    );
    const lastMessageMap = new Map(
      lastMessages.map((r) => [
        r.conversationId,
        { body: r.body, senderRole: r.senderRole, createdAt: r.createdAt },
      ]),
    );

    const data = rows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      orderId: row.orderId,
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
      clientName: row.clientName,
      clientFirstName: row.clientFirstName,
      clientLastName: row.clientLastName,
      unreadCount: unreadMap.get(row.id) ?? 0,
      lastMessage: lastMessageMap.get(row.id) ?? null,
      orderInfo: row.orderId
        ? {
            status: row.orderStatus,
            quantity: row.orderQuantity,
            totalPrice: row.orderTotalPrice,
            pickupAt: row.orderPickupAt,
            listingTitle: row.listingTitle,
          }
        : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[inbox/conversations GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations." },
      { status: 500 },
    );
  }
}

// ─── POST /api/business/inbox/conversations ───────────────────────────────────
// Create a new conversation (or upsert) and optionally send the first message.

const postSchema = z.object({
  clientId: z.string().min(1),
  orderId: z.string().uuid().optional(),
  initialMessage: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 },
    );
  }

  const { clientId, orderId, initialMessage } = parsed.data;

  try {
    const orderOwnershipConditions = [
      eq(orders.cookId, cookId),
      eq(orders.clientId, clientId),
    ];
    if (orderId) {
      orderOwnershipConditions.push(eq(orders.id, orderId));
    }

    const [authorizedOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(...orderOwnershipConditions))
      .limit(1);

    if (!authorizedOrder) {
      return NextResponse.json(
        { error: "Client/order does not belong to this cook." },
        { status: 403 },
      );
    }

    // Check if a conversation already exists for this cook+client+order triple
    const conditions = [
      eq(conversations.cookId, cookId),
      eq(conversations.clientId, clientId),
    ];

    if (orderId) {
      conditions.push(eq(conversations.orderId, orderId));
    } else {
      conditions.push(sql`${conversations.orderId} IS NULL`);
    }

    const [existing] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(...conditions))
      .limit(1);

    let conversationId: string;

    if (existing) {
      conversationId = existing.id;
      // Insert a new message into the existing conversation
      await db.insert(messages).values({
        conversationId,
        senderRole: "cook",
        body: initialMessage,
      });
      // Update lastMessageAt
      await db
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } else {
      // Create a new conversation and insert the first message
      const [created] = await db
        .insert(conversations)
        .values({
          cookId,
          clientId,
          orderId: orderId ?? null,
          lastMessageAt: new Date(),
        })
        .returning({ id: conversations.id });

      if (!created) {
        return NextResponse.json(
          { error: "Failed to create conversation." },
          { status: 500 },
        );
      }

      conversationId = created.id;

      await db.insert(messages).values({
        conversationId,
        senderRole: "cook",
        body: initialMessage,
      });
    }

    return NextResponse.json(
      { success: true, data: { conversationId } },
      { status: existing ? 200 : 201 },
    );
  } catch (err) {
    console.error("[inbox/conversations POST]", err);
    return NextResponse.json(
      { error: "Failed to create conversation." },
      { status: 500 },
    );
  }
}
