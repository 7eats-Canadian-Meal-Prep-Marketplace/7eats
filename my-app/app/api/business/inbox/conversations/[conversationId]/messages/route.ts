import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

export type Params = { params: Promise<{ conversationId: string }> };

const conversationIdSchema = z.string().uuid();

const postSchema = z.object({
  body: z.string().min(1).max(5000),
});

// ─── POST /api/business/inbox/conversations/[conversationId]/messages ─────────
// Send a message in a conversation as the cook.

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

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

  const { body } = parsed.data;

  try {
    // Verify the cook owns this conversation
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.cookId, cookId),
        ),
      )
      .limit(1);

    if (!conversation) return notFound("Conversation");

    // Insert message and update lastMessageAt in parallel
    const now = new Date();

    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        senderRole: "cook",
        body,
        createdAt: now,
      })
      .returning({
        id: messages.id,
        conversationId: messages.conversationId,
        senderRole: messages.senderRole,
        body: messages.body,
        isReadByCook: messages.isReadByCook,
        isReadByClient: messages.isReadByClient,
        createdAt: messages.createdAt,
      });

    await db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json(
      { success: true, data: newMessage },
      { status: 201 },
    );
  } catch (err) {
    console.error("[inbox/conversations/[conversationId]/messages POST]", err);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 },
    );
  }
}
