"use client";

import { ArrowLeft, ChevronRight, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

// ─── Local types ──────────────────────────────────────────────────────────────

type Thread = {
  id: string;
  cookId: string;
  cookName: string;
  cookFirstName: string | null;
  orderId: string | null;
  listingTitle: string | null;
  lastMessage: { text: string; sentAt: string } | null;
  unreadCount: number;
  orderCompleted: boolean;
  updatedAt: string;
};

type Message = {
  id: string;
  senderRole: "client" | "cook";
  text: string;
  sentAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive two-letter initials from a cook's display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

/**
 * Deterministic avatar gradient seeded from the cook ID so the colour is
 * stable across renders but varies between cooks.
 */
function getAvatarGradient(cookId: string): string {
  const palettes = [
    "linear-gradient(135deg, #6b6b6b 0%, #3a3a3a 100%)",
    "linear-gradient(135deg, #757575 0%, #454545 100%)",
    "linear-gradient(135deg, #828282 0%, #505050 100%)",
    "linear-gradient(135deg, #585858 0%, #2e2e2e 100%)",
    "linear-gradient(135deg, #707070 0%, #424242 100%)",
    "linear-gradient(135deg, #6a6a6a 0%, #383838 100%)",
    "linear-gradient(135deg, #797979 0%, #484848 100%)",
    "linear-gradient(135deg, #676767 0%, #3c3c3c 100%)",
  ];
  // Sum char codes of the cook ID for a cheap stable index
  const seed = cookId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palettes[seed % palettes.length] ?? palettes[0];
}

/** Format an ISO timestamp to a short human-readable string. */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationClosed, setConversationClosed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch thread list ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetch("/api/inbox")
      .then((r) => {
        if (r.status === 401) {
          // Not signed in — redirect to login
          window.location.href = "/app-auth/login";
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (cancelled || json === null) return;
        setThreads(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setThreads([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Fetch messages when a thread is selected ───────────────────────────────
  useEffect(() => {
    if (!selectedThread) return;

    let cancelled = false;
    const id = selectedThread.id;

    setMessagesLoading(true);
    setMessages([]);

    // Fetch messages and mark as read in parallel
    Promise.all([
      fetch(`/api/inbox/${id}/messages`).then((r) => r.json()),
      fetch(`/api/inbox/${id}/read`, { method: "PATCH" }),
    ])
      .then(([json]) => {
        if (cancelled) return;
        setMessages(json.data ?? []);
        // Clear unread count locally after marking as read
        setThreads((prev) =>
          prev.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t)),
        );
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedThread]);

  // ── Scroll to bottom when messages load or new message arrives ─────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever messages array changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Select a thread ────────────────────────────────────────────────────────
  function handleSelect(thread: Thread) {
    setSelectedThread(thread);
    setConversationClosed(thread.orderCompleted);
    setDraft("");
  }

  // ── Send a message ─────────────────────────────────────────────────────────
  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedThread || sending) return;

    setSending(true);

    try {
      const res = await fetch(`/api/inbox/${selectedThread.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const json = await res.json();

      if (res.status === 403) {
        // Order closed — disable the composer
        setConversationClosed(true);
        return;
      }

      if (json.success && json.data) {
        const newMsg: Message = {
          id: json.data.id,
          senderRole: "client",
          text: json.data.text,
          sentAt: json.data.sentAt,
        };
        setMessages((prev) => [...prev, newMsg]);
        setDraft("");

        // Update thread preview
        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThread.id
              ? {
                  ...t,
                  lastMessage: { text, sentAt: json.data.sentAt },
                  updatedAt: json.data.sentAt,
                }
              : t,
          ),
        );
      }
    } catch {
      // Network error — silently ignore, message not sent
    } finally {
      setSending(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalUnread = threads.reduce((acc, t) => acc + t.unreadCount, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Thread list */}
      <div
        className={`${styles.threadList} ${selectedThread ? styles.threadListHidden : ""}`}
      >
        <div className={styles.listHeader}>
          <h1 className={styles.heading}>
            Inbox
            {totalUnread > 0 && (
              <span className={styles.unreadBadge}>{totalUnread}</span>
            )}
          </h1>
        </div>

        {loading && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>Loading…</p>
          </div>
        )}

        {!loading && threads.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No messages yet.</p>
            <p className={styles.emptyDesc}>
              When you message a cook, it shows up here.
            </p>
          </div>
        )}

        {threads.map((thread) => {
          const initials = getInitials(thread.cookName);
          const gradient = getAvatarGradient(thread.cookId);
          const isUnread = thread.unreadCount > 0;

          return (
            <button
              key={thread.id}
              type="button"
              className={`${styles.threadItem} ${isUnread ? styles.threadUnread : ""}`}
              onClick={() => handleSelect(thread)}
            >
              <div
                className={styles.threadAvatar}
                style={{ background: gradient }}
              >
                {initials}
              </div>
              <div className={styles.threadInfo}>
                <div className={styles.threadTop}>
                  <span className={styles.threadName}>{thread.cookName}</span>
                  <span className={styles.threadTime}>
                    {thread.lastMessage?.sentAt
                      ? formatTime(thread.lastMessage.sentAt)
                      : formatTime(thread.updatedAt)}
                  </span>
                </div>
                <span className={styles.threadPreview}>
                  {thread.lastMessage?.text ?? "No messages yet"}
                </span>
              </div>
              {isUnread && <span className={styles.unreadDot} />}
            </button>
          );
        })}
      </div>

      {/* Chat panel */}
      {selectedThread && (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <button
              type="button"
              className={styles.chatBack}
              onClick={() => setSelectedThread(null)}
            >
              <ArrowLeft size={20} />
            </button>
            <div
              className={styles.chatAvatar}
              style={{ background: getAvatarGradient(selectedThread.cookId) }}
            >
              {getInitials(selectedThread.cookName)}
            </div>
            <div className={styles.chatHeaderInfo}>
              <span className={styles.chatName}>{selectedThread.cookName}</span>
              <span className={styles.chatStatus}>Cook</span>
            </div>

            {/* Order chip — links to the associated order */}
            {selectedThread.orderId && (
              <Link
                href={`/app/orders/${selectedThread.orderId}`}
                className={styles.orderChip}
              >
                <div className={styles.orderChipThumb} />
                <span className={styles.orderChipTitle}>
                  {selectedThread.listingTitle ?? "View order"}
                </span>
                <ChevronRight size={13} className={styles.orderChipArrow} />
              </Link>
            )}
          </div>

          <div className={styles.messages}>
            {messagesLoading && (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--grey-500)",
                  fontSize: 13,
                  padding: "24px 0",
                }}
              >
                Loading messages…
              </p>
            )}

            {!messagesLoading && messages.length === 0 && (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--grey-500)",
                  fontSize: 13,
                  padding: "24px 0",
                }}
              >
                No messages in this conversation yet.
              </p>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.msgRow} ${msg.senderRole === "client" ? styles.msgRowClient : styles.msgRowCook}`}
              >
                {msg.senderRole === "cook" && (
                  <div
                    className={styles.msgAvatar}
                    style={{
                      background: getAvatarGradient(selectedThread.cookId),
                    }}
                  >
                    {getInitials(selectedThread.cookName)}
                  </div>
                )}
                <div
                  className={`${styles.bubble} ${msg.senderRole === "client" ? styles.bubbleClient : styles.bubbleCook}`}
                >
                  <span className={styles.bubbleText}>{msg.text}</span>
                  <span className={styles.bubbleTime}>
                    {formatTime(msg.sentAt)}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {conversationClosed ? (
            <div className={styles.composerClosed}>
              Messaging is unavailable for this order.
            </div>
          ) : (
            <div className={styles.composer}>
              <input
                type="text"
                className={styles.composerInput}
                placeholder={`Message ${selectedThread.cookName}…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!draft.trim() || sending}
              >
                <Send size={17} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Desktop: empty state when nothing selected */}
      {!selectedThread && (
        <div className={styles.chatPlaceholder}>
          <p className={styles.placeholderText}>
            Select a conversation to read messages
          </p>
        </div>
      )}
    </div>
  );
}
