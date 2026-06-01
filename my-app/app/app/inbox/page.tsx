"use client";

import { ArrowLeft, Send } from "lucide-react";
import { useState } from "react";
import { MOCK_MESSAGE_THREADS, type MockMessageThread } from "../_mock";
import styles from "./page.module.css";

export default function InboxPage() {
  const [threads, setThreads] =
    useState<MockMessageThread[]>(MOCK_MESSAGE_THREADS);
  const [selected, setSelected] = useState<MockMessageThread | null>(null);
  const [draft, setDraft] = useState("");

  const handleSelect = (thread: MockMessageThread) => {
    setSelected(thread);
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, unread: false } : t)),
    );
  };

  const handleSend = () => {
    if (!draft.trim() || !selected) return;
    const newMsg = {
      id: `m-${Date.now()}`,
      from: "client" as const,
      text: draft.trim(),
      timestamp: "Just now",
    };
    const updated = {
      ...selected,
      messages: [...selected.messages, newMsg],
      preview: draft.trim(),
      timestamp: "Just now",
    };
    setSelected(updated);
    setThreads((prev) => prev.map((t) => (t.id === selected.id ? updated : t)));
    setDraft("");
  };

  const unreadCount = threads.filter((t) => t.unread).length;

  return (
    <div className={styles.page}>
      {/* Thread list */}
      <div
        className={`${styles.threadList} ${selected ? styles.threadListHidden : ""}`}
      >
        <div className={styles.listHeader}>
          <h1 className={styles.heading}>
            Inbox
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>{unreadCount}</span>
            )}
          </h1>
        </div>

        {threads.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No messages yet.</p>
            <p className={styles.emptyDesc}>
              When you message a cook, it shows up here.
            </p>
          </div>
        )}

        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={`${styles.threadItem} ${thread.unread ? styles.threadUnread : ""}`}
            onClick={() => handleSelect(thread)}
          >
            <div
              className={styles.threadAvatar}
              style={{ background: thread.cookGradient }}
            >
              {thread.cookInitials}
            </div>
            <div className={styles.threadInfo}>
              <div className={styles.threadTop}>
                <span className={styles.threadName}>{thread.cookName}</span>
                <span className={styles.threadTime}>{thread.timestamp}</span>
              </div>
              <span className={styles.threadPreview}>{thread.preview}</span>
            </div>
            {thread.unread && <span className={styles.unreadDot} />}
          </button>
        ))}
      </div>

      {/* Chat panel */}
      {selected && (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <button
              type="button"
              className={styles.chatBack}
              onClick={() => setSelected(null)}
            >
              <ArrowLeft size={20} />
            </button>
            <div
              className={styles.chatAvatar}
              style={{ background: selected.cookGradient }}
            >
              {selected.cookInitials}
            </div>
            <div className={styles.chatHeaderInfo}>
              <span className={styles.chatName}>{selected.cookName}</span>
              <span className={styles.chatStatus}>Cook · Active recently</span>
            </div>
          </div>

          <div className={styles.messages}>
            {selected.messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.msgRow} ${msg.from === "client" ? styles.msgRowClient : styles.msgRowCook}`}
              >
                {msg.from === "cook" && (
                  <div
                    className={styles.msgAvatar}
                    style={{ background: selected.cookGradient }}
                  >
                    {selected.cookInitials}
                  </div>
                )}
                <div
                  className={`${styles.bubble} ${msg.from === "client" ? styles.bubbleClient : styles.bubbleCook}`}
                >
                  <span className={styles.bubbleText}>{msg.text}</span>
                  <span className={styles.bubbleTime}>{msg.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.composer}>
            <input
              type="text"
              className={styles.composerInput}
              placeholder={`Message ${selected.cookName}…`}
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
              disabled={!draft.trim()}
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop: empty state when nothing selected */}
      {!selected && (
        <div className={styles.chatPlaceholder}>
          <p className={styles.placeholderText}>
            Select a conversation to read messages
          </p>
        </div>
      )}
    </div>
  );
}
