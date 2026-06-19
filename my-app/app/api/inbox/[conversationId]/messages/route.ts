import { and, asc, count, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidden,
  getClientSession,
  unauthorized,
} from "@/app/api/_lib/client-auth";
import { db } from "@/db";
import { conversations, messages, orders } from "@/db/schema";

export type Params = { params: Promise<{ conversationId: string }> };

const conversationIdSchema = z.string().uuid();

const postSchema = z.object({
  text: z.string().min(1).max(2000),
});

// ─── GET /api/inbox/[conversationId]/messages ─────────────────────────────────
// Fetch paginated messages for a conversation the client owns.

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getClientSession(req.headers);
  if (!session?.user || session.user.role !== "client") return unauthorized();

  const clientId = session.user.id;
  const { conversationId } = await params;

  const idParsed = conversationIdSchema.safeParse(conversationId);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  try {
    // Verify the client owns this conversation
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.clientId, clientId),
        ),
      )
      .limit(1);

    if (!conversation) return forbidden();

    // Fetch messages and total count in parallel
    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: messages.id,
          senderRole: messages.senderRole,
          body: messages.body,
          isReadByClient: messages.isReadByClient,
          isReadByCook: messages.isReadByCook,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: count() })
        .from(messages)
        .where(eq(messages.conversationId, conversationId)),
    ]);

    const total = Number(totalResult[0]?.total ?? 0);

    const data = rows.map((row) => ({
      id: row.id,
      senderId: null, // messages table stores senderRole, not senderId
      senderRole: row.senderRole as "client" | "cook",
      text: row.body,
      sentAt: row.createdAt.toISOString(),
      readAt: null, // schema uses isReadByClient/isReadByCook booleans, not a timestamp
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset },
    });
  } catch (err) {
    console.error("[inbox/[conversationId]/messages GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch messages." },
      { status: 500 },
    );
  }
}

// ─── POST /api/inbox/[conversationId]/messages ────────────────────────────────
// Send a message in a conversation as the client.

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getClientSession(req.headers);
  if (!session?.user || session.user.role !== "client") return unauthorized();

  const clientId = session.user.id;
  const { conversationId } = await params;

  const idParsed = conversationIdSchema.safeParse(conversationId);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 },
    );
  }

  const { text } = parsed.data;

  try {
    // Verify the client owns this conversation
    const [conversation] = await db
      .select({
        id: conversations.id,
        orderId: conversations.orderId,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.clientId, clientId),
        ),
      )
      .limit(1);

    if (!conversation) return forbidden();

    // Check if order is completed — block messaging for fulfilled/cancelled orders
    if (conversation.orderId) {
      const [order] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, conversation.orderId))
        .limit(1);

      if (
        order &&
        (order.status === "fulfilled" || order.status === "cancelled")
      ) {
        return NextResponse.json(
          { error: "Messaging is closed for completed orders." },
          { status: 403 },
        );
      }
    }

    const now = new Date();

    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        senderRole: "client",
        body: text,
        createdAt: now,
      })
      .returning({
        id: messages.id,
        senderRole: messages.senderRole,
        body: messages.body,
        createdAt: messages.createdAt,
      });

    // Update lastMessageAt on the conversation
    await db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newMessage?.id,
          senderId: clientId,
          senderRole: "client" as const,
          text: newMessage?.body,
          sentAt: newMessage?.createdAt?.toISOString() ?? now.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[inbox/[conversationId]/messages POST]", err);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 },
    );
  }
}
