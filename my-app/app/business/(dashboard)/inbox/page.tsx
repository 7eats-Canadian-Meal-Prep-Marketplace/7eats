"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { type MessageType, MOCK_MESSAGES, type MockMessage } from "./_mock";
import styles from "./page.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday · ${time}`;
  return d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function preview(body: string): string {
  return body.length > 80 ? `${body.slice(0, 80).trimEnd()}…` : body;
}

const TYPE_LABEL: Record<MessageType, string> = {
  order_update: "Order update",
  support: "Support",
  system: "System",
};

const TYPE_CLS: Record<MessageType, string> = {
  order_update: styles.tagOrder,
  support: styles.tagSupport,
  system: styles.tagSystem,
};

// ─── Message detail ───────────────────────────────────────────────────────────

function MessageDetail({
  message,
  onClose,
}: {
  message: MockMessage;
  onClose?: () => void;
}) {
  return (
    <div className={styles.detail}>
      {onClose && (
        <button type="button" className={styles.detailClose} onClick={onClose}>
          <X size={16} />
        </button>
      )}

      <div className={styles.detailHeader}>
        <span className={`${styles.tag} ${TYPE_CLS[message.type]}`}>
          {TYPE_LABEL[message.type]}
        </span>
        <h2 className={styles.detailSubject}>{message.subject}</h2>
        <div className={styles.detailMeta}>
          <span className={styles.detailSender}>{message.senderName}</span>
          <span className={styles.detailTime}>
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>

      <p className={styles.detailBody}>{message.body}</p>
    </div>
  );
}

// ─── Message list row ─────────────────────────────────────────────────────────

function MessageListRow({
  message,
  focused,
  onSelect,
}: {
  message: MockMessage;
  focused: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.listRow} ${focused ? styles.listRowFocused : ""}`}
      onClick={onSelect}
    >
      <span className={styles.listDotCol}>
        {!message.isRead && <span className={styles.unreadDot} />}
      </span>
      <span className={styles.listRowMain}>
        <span className={styles.listRowTop}>
          <span
            className={`${styles.listSender} ${!message.isRead ? styles.listSenderUnread : ""}`}
          >
            {message.senderName}
          </span>
          <span className={styles.listTime}>
            {formatTime(message.timestamp)}
          </span>
        </span>
        <span className={styles.listSubject}>{message.subject}</span>
        <span className={styles.listPreview}>{preview(message.body)}</span>
      </span>
    </button>
  );
}

// ─── Empty detail ─────────────────────────────────────────────────────────────

function EmptyDetail() {
  return <div className={styles.emptyDetail}>Select a message to read it</div>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [messages, setMessages] = useState<MockMessage[]>(MOCK_MESSAGES);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);

  const focused = messages.find((m) => m.id === focusedId) ?? null;
  const unreadCount = messages.filter((m) => !m.isRead).length;

  function handleSelect(id: string) {
    setFocusedId(id);
    setSlideOpen(true);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)),
    );
  }

  return (
    <div className={styles.page}>
      {/* Left: message list */}
      <div className={styles.listPanel}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Inbox</span>
          {unreadCount > 0 && (
            <span className={styles.listHeadCount}>{unreadCount} unread</span>
          )}
        </div>

        {messages.map((m) => (
          <MessageListRow
            key={m.id}
            message={m}
            focused={focusedId === m.id}
            onSelect={() => handleSelect(m.id)}
          />
        ))}
      </div>

      {/* Right: detail panel (desktop) */}
      <div className={styles.detailPanel}>
        {focused ? (
          <MessageDetail key={focused.id} message={focused} />
        ) : (
          <EmptyDetail />
        )}
      </div>

      {/* Mobile slide-over */}
      {slideOpen && focused && (
        <>
          <button
            type="button"
            aria-label="Close"
            className={styles.slideOverlay}
            onClick={() => setSlideOpen(false)}
          />
          <div className={styles.slideOver}>
            <MessageDetail
              key={focused.id}
              message={focused}
              onClose={() => setSlideOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
