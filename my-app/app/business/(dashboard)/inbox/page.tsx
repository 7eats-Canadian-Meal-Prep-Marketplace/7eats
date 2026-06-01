"use client";

import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

type OrderInfo = {
  status: OrderStatus | null;
  quantity: number | null;
  totalPrice: string | null;
  pickupAt: string | null;
  listingTitle: string | null;
};

type Message = {
  id: string;
  conversationId: string;
  senderRole: "cook" | "client";
  body: string;
  isReadByCook: boolean;
  createdAt: string;
};

type ConversationSummary = {
  id: string;
  clientId: string;
  orderId: string | null;
  lastMessageAt: string;
  clientName: string | null;
  clientFirstName: string | null;
  unreadCount: number;
  lastMessage: { body: string; senderRole: string; createdAt: string } | null;
  orderInfo: OrderInfo | null;
};

type ConversationDetail = ConversationSummary & {
  messages: Message[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

function displayName(conv: {
  clientName: string | null;
  clientFirstName: string | null;
}): string {
  if (conv.clientName) return conv.clientName;
  if (conv.clientFirstName) return conv.clientFirstName;
  return "Customer";
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

function pickupLabel(iso: string | null): string {
  if (!iso) return "—";
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

// ─── Order context bar ────────────────────────────────────────────────────────

function OrderBar({
  orderInfo,
  orderId,
}: {
  orderInfo: OrderInfo;
  orderId: string;
}) {
  const status = orderInfo.status as OrderStatus | null;
  return (
    <div className={styles.orderBar}>
      <div className={styles.orderBarTop}>
        <span className={styles.orderTitle}>
          {orderInfo.listingTitle ?? "Order"}
        </span>
        {status && (
          <span className={`${styles.statusBadge} ${STATUS_CLS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <div className={styles.orderFacts}>
        {orderInfo.quantity != null && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>Quantity</span>
            <span className={styles.factValue}>
              {orderInfo.quantity}{" "}
              {orderInfo.quantity === 1 ? "serving" : "servings"}
            </span>
          </div>
        )}
        {orderInfo.totalPrice != null && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>Order total</span>
            <span className={styles.factValue}>${orderInfo.totalPrice}</span>
          </div>
        )}
        <div className={styles.fact}>
          <span className={styles.factLabel}>Pickup</span>
          <span className={styles.factValue}>
            {pickupLabel(orderInfo.pickupAt)}
          </span>
        </div>
        <Link
          href={`/business/orders?order=${orderId}`}
          className={styles.viewOrderBtn}
        >
          View full order
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

// ─── Thread ───────────────────────────────────────────────────────────────────

function Thread({
  conversation,
  onSend,
  onBack,
}: {
  conversation: ConversationDetail;
  onSend: (body: string) => void;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const name = displayName(conversation);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages / conversation switch
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.id, conversation.messages.length]);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/business/inbox/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (res.ok) {
        onSend(body);
        setDraft("");
      }
    } finally {
      setSending(false);
    }
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
        <span className={styles.threadAvatar}>{initials(name)}</span>
        <span className={styles.threadName}>{name}</span>
      </div>

      {conversation.orderInfo && conversation.orderId && (
        <OrderBar
          orderInfo={conversation.orderInfo}
          orderId={conversation.orderId}
        />
      )}

      <div className={styles.messages} ref={scrollRef}>
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.bubbleRow} ${m.senderRole === "cook" ? styles.bubbleRowMine : ""}`}
          >
            <div
              className={`${styles.bubble} ${m.senderRole === "cook" ? styles.bubbleMine : ""}`}
            >
              {m.body}
            </div>
            <span className={styles.bubbleTime}>{bubbleTime(m.createdAt)}</span>
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.composerInput}
          placeholder={`Message ${name.split(" ")[0]}…`}
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
          disabled={!draft.trim() || sending}
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
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedDetail, setFocusedDetail] = useState<ConversationDetail | null>(
    null,
  );
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [slideOpen, setSlideOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/business/inbox/conversations");
      if (res.ok) {
        const json = await res.json();
        setConversations(json.data ?? []);
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!focusedId) return;
    setLoadingDetail(true);
    fetch(`/api/business/inbox/conversations/${focusedId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setFocusedDetail(json.data);
          // Mark as read in local state
          setConversations((prev) =>
            prev.map((c) =>
              c.id === focusedId ? { ...c, unreadCount: 0 } : c,
            ),
          );
        }
      })
      .finally(() => setLoadingDetail(false));
  }, [focusedId]);

  const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );

  function handleSelect(id: string) {
    setFocusedId(id);
    setSlideOpen(true);
  }

  function handleSend(body: string) {
    if (!focusedId || !focusedDetail) return;
    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: focusedId,
      senderRole: "cook",
      body,
      isReadByCook: true,
      createdAt: new Date().toISOString(),
    };
    setFocusedDetail((prev) =>
      prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev,
    );
    setConversations((prev) =>
      prev.map((c) =>
        c.id === focusedId
          ? {
              ...c,
              lastMessageAt: newMsg.createdAt,
              lastMessage: {
                body,
                senderRole: "cook",
                createdAt: newMsg.createdAt,
              },
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

        {loadingList ? (
          <div style={{ padding: "1rem", color: "var(--muted)" }}>Loading…</div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: "1rem", color: "var(--muted)" }}>
            No messages yet.
          </div>
        ) : (
          sorted.map((c) => {
            const last = c.lastMessage;
            const name = displayName(c);
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.listRow} ${focusedId === c.id ? styles.listRowFocused : ""} ${c.unreadCount > 0 ? styles.listRowUnread : ""}`}
                onClick={() => handleSelect(c.id)}
              >
                <span className={styles.listAvatar}>{initials(name)}</span>
                <span className={styles.listRowMain}>
                  <span className={styles.listRowTop}>
                    <span
                      className={`${styles.listName} ${c.unreadCount > 0 ? styles.listNameUnread : ""}`}
                    >
                      {name}
                    </span>
                    <span
                      className={`${styles.listTime} ${c.unreadCount > 0 ? styles.listTimeUnread : ""}`}
                    >
                      {listTime(c.lastMessageAt)}
                    </span>
                  </span>
                  {c.orderInfo?.listingTitle && (
                    <span className={styles.listOrder}>
                      {c.orderInfo.listingTitle}
                    </span>
                  )}
                  {last && (
                    <span
                      className={`${styles.listPreview} ${c.unreadCount > 0 ? styles.listPreviewUnread : ""}`}
                    >
                      {last.senderRole === "cook" && (
                        <span className={styles.listYou}>You: </span>
                      )}
                      {last.body}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Right: thread (desktop) */}
      <div className={styles.threadPanel}>
        {loadingDetail ? (
          <div className={styles.emptyThread}>Loading…</div>
        ) : focusedDetail ? (
          <Thread
            key={focusedDetail.id}
            conversation={focusedDetail}
            onSend={handleSend}
          />
        ) : (
          <div className={styles.emptyThread}>
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {/* Mobile slide-over */}
      {slideOpen && focusedDetail && (
        <div className={styles.slideOver}>
          <Thread
            key={focusedDetail.id}
            conversation={focusedDetail}
            onSend={handleSend}
            onBack={() => setSlideOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
