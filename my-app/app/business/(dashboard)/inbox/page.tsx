"use client";

import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type ChatMessage,
  type ConversationOrder,
  MOCK_CONVERSATIONS,
  type MockConversation,
  type OrderStatus,
} from "./_mock";
import styles from "./page.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

function listTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return time;
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function bubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function pickupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === tomorrow.toDateString())
    return `Tomorrow at ${time}`;
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday at ${time}`;
  const date = d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
  return `${date} at ${time}`;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

const STATUS_CLS: Record<OrderStatus, string> = {
  pending: styles.statusPending,
  confirmed: styles.statusActive,
  ready: styles.statusActive,
  fulfilled: styles.statusMuted,
  cancelled: styles.statusMuted,
};

function lastMessage(c: MockConversation): ChatMessage {
  return c.messages[c.messages.length - 1];
}

// ─── Order context bar ─────────────────────────────────────────────────────────

function OrderBar({ order }: { order: ConversationOrder }) {
  return (
    <div className={styles.orderBar}>
      <div className={styles.orderBarTop}>
        <span className={styles.orderTitle}>{order.listingTitle}</span>
        <span className={`${styles.statusBadge} ${STATUS_CLS[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className={styles.orderFacts}>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Quantity</span>
          <span className={styles.factValue}>
            {order.quantity} {order.quantity === 1 ? "serving" : "servings"}
          </span>
        </div>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Order total</span>
          <span className={styles.factValue}>${order.totalPrice}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Pickup</span>
          <span className={styles.factValue}>
            {pickupLabel(order.pickupAt)}
          </span>
        </div>
        <Link
          href={`/business/orders?order=${order.id}`}
          className={styles.viewOrderBtn}
        >
          View full order
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

// ─── Thread (chat) ──────────────────────────────────────────────────────────────

function Thread({
  conversation,
  onSend,
  onBack,
}: {
  conversation: MockConversation;
  onSend: (body: string) => void;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages / conversation switch
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.id, conversation.messages.length]);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  }

  return (
    <div className={styles.thread}>
      <div className={styles.threadHead}>
        {onBack && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={onBack}
            aria-label="Back to inbox"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <span className={styles.threadAvatar}>
          {initials(conversation.customerName)}
        </span>
        <span className={styles.threadName}>{conversation.customerName}</span>
      </div>

      <OrderBar order={conversation.order} />

      <div className={styles.messages} ref={scrollRef}>
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.bubbleRow} ${m.from === "cook" ? styles.bubbleRowMine : ""}`}
          >
            <div
              className={`${styles.bubble} ${m.from === "cook" ? styles.bubbleMine : ""}`}
            >
              {m.body}
            </div>
            <span className={styles.bubbleTime}>{bubbleTime(m.timestamp)}</span>
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.composerInput}
          placeholder={`Message ${conversation.customerName.split(" ")[0]}…`}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={submit}
          disabled={!draft.trim()}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [conversations, setConversations] =
    useState<MockConversation[]>(MOCK_CONVERSATIONS);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);

  const focused = conversations.find((c) => c.id === focusedId) ?? null;
  const unreadCount = conversations.filter((c) => c.unread).length;

  // Most recent activity first.
  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(lastMessage(b).timestamp).getTime() -
      new Date(lastMessage(a).timestamp).getTime(),
  );

  function handleSelect(id: string) {
    setFocusedId(id);
    setSlideOpen(true);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: false } : c)),
    );
  }

  function handleSend(body: string) {
    if (!focusedId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === focusedId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: `${c.id}-${c.messages.length + 1}`,
                  from: "cook",
                  body,
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    );
  }

  return (
    <div className={styles.page}>
      {/* Left: conversation list */}
      <div className={styles.listPanel}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Messages</span>
          {unreadCount > 0 && (
            <span className={styles.listHeadCount}>{unreadCount} unread</span>
          )}
        </div>

        {sorted.map((c) => {
          const last = lastMessage(c);
          return (
            <button
              key={c.id}
              type="button"
              className={`${styles.listRow} ${focusedId === c.id ? styles.listRowFocused : ""} ${c.unread ? styles.listRowUnread : ""}`}
              onClick={() => handleSelect(c.id)}
            >
              <span className={styles.listAvatar}>
                {initials(c.customerName)}
              </span>
              <span className={styles.listRowMain}>
                <span className={styles.listRowTop}>
                  <span
                    className={`${styles.listName} ${c.unread ? styles.listNameUnread : ""}`}
                  >
                    {c.customerName}
                  </span>
                  <span
                    className={`${styles.listTime} ${c.unread ? styles.listTimeUnread : ""}`}
                  >
                    {listTime(last.timestamp)}
                  </span>
                </span>
                <span className={styles.listOrder}>{c.order.listingTitle}</span>
                <span
                  className={`${styles.listPreview} ${c.unread ? styles.listPreviewUnread : ""}`}
                >
                  {last.from === "cook" && (
                    <span className={styles.listYou}>You: </span>
                  )}
                  {last.body}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: thread (desktop) */}
      <div className={styles.threadPanel}>
        {focused ? (
          <Thread key={focused.id} conversation={focused} onSend={handleSend} />
        ) : (
          <div className={styles.emptyThread}>
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {/* Mobile slide-over */}
      {slideOpen && focused && (
        <div className={styles.slideOver}>
          <Thread
            key={focused.id}
            conversation={focused}
            onSend={handleSend}
            onBack={() => setSlideOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
