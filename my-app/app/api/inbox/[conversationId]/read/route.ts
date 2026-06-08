import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidden,
  getClientSession,
  unauthorized,
} from "@/app/api/subscriptions/_lib/client-auth";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

export type Params = { params: Promise<{ conversationId: string }> };

const conversationIdSchema = z.string().uuid();

// ─── PATCH /api/inbox/[conversationId]/read ───────────────────────────────────
// Mark all unread cook messages in the conversation as read by the client.

export async function PATCH(req: NextRequest, { params }: Params) {
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

    // Mark all unread cook messages as read by the client
    // (messages sent by cook that the client hasn't read yet)
    const updated = await db
      .update(messages)
      .set({ isReadByClient: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderRole, "cook"),
          eq(messages.isReadByClient, false),
        ),
      )
      .returning({ id: messages.id });

    return NextResponse.json({
      success: true,
      markedCount: updated.length,
    });
  } catch (err) {
    console.error("[inbox/[conversationId]/read PATCH]", err);
    return NextResponse.json(
      { error: "Failed to mark messages as read." },
      { status: 500 },
    );
  }
}
