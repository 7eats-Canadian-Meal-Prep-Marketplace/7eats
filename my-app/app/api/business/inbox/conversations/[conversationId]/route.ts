import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/_lib/cook-auth";
import { db } from "@/db";
import {
  authUser,
  conversations,
  listings,
  messages,
  orders,
} from "@/db/schema";

export type Params = { params: Promise<{ conversationId: string }> };

const conversationIdSchema = z.string().uuid();

// ─── GET /api/business/inbox/conversations/[conversationId] ───────────────────
// Get a single conversation with all messages.
// Also marks all unread messages (isReadByCook=false) as read.

export async function GET(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { conversationId } = await params;

  const parsed = conversationIdSchema.safeParse(conversationId);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  try {
    // Verify cook owns this conversation and fetch details
    const [conversation] = await db
      .select({
        id: conversations.id,
        cookId: conversations.cookId,
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
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.cookId, cookId),
        ),
      )
      .limit(1);

    if (!conversation) return notFound("Conversation");

    // Fetch all messages sorted oldest-first
    const conversationMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderRole: messages.senderRole,
        body: messages.body,
        isReadByCook: messages.isReadByCook,
        isReadByClient: messages.isReadByClient,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    // Mark unread messages as read (fire-and-forget, non-blocking)
    const hasUnread = conversationMessages.some((m) => !m.isReadByCook);
    if (hasUnread) {
      db.update(messages)
        .set({ isReadByCook: true })
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isReadByCook, false),
          ),
        )
        .catch((err) => {
          console.error(
            "[inbox/conversations/[conversationId] mark-read]",
            err,
          );
        });
    }

    const orderInfo = conversation.orderId
      ? {
          status: conversation.orderStatus,
          quantity: conversation.orderQuantity,
          totalPrice: conversation.orderTotalPrice,
          pickupAt: conversation.orderPickupAt,
          listingTitle: conversation.listingTitle,
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        cookId: conversation.cookId,
        clientId: conversation.clientId,
        orderId: conversation.orderId,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        clientName: conversation.clientName,
        clientFirstName: conversation.clientFirstName,
        clientLastName: conversation.clientLastName,
        orderInfo,
        messages: conversationMessages,
      },
    });
  } catch (err) {
    console.error("[inbox/conversations/[conversationId] GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch conversation." },
      { status: 500 },
    );
  }
}
