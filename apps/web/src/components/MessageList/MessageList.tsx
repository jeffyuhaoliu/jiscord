import { useEffect, useRef, useCallback, useState } from "react";
import type { Message, MessagesResponse } from "../../types/message";
import type { MessageCreatePayload } from "../../hooks/useGateway";

interface Props {
  channelId: string | null;
  on: (
    event: "MESSAGE_CREATE",
    cb: (data: MessageCreatePayload) => void
  ) => () => void;
}

const PAGE_SIZE = 50;

export function MessageList({ channelId, on }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextPageState, setNextPageState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setNextPageState(null);
      return;
    }
    setLoading(true);
    setMessages([]);
    setNextPageState(null);

    const controller = new AbortController();
    const baseUrl = "/api/data/channels/" + channelId + "/messages?limit=" + String(PAGE_SIZE);
    fetch(baseUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + String(res.status));
        return res.json() as Promise<MessagesResponse>;
      })
      .then(({ messages: msgs, nextPageState: nps }) => {
        setMessages([...msgs].reverse());
        setNextPageState(nps);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[MessageList] fetch error", err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [channelId]);

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [loading]);

  useEffect(() => {
    const off = on("MESSAGE_CREATE", (payload) => {
      if (payload.channelId !== channelId) return;
      const newMsg: Message = {
        message_id: payload.messageId,
        channel_id: payload.channelId,
        author_id: payload.authorId,
        content: payload.content,
        created_at: payload.createdAt,
      };
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    });
    return off;
  }, [channelId, on]);

  const loadMore = useCallback(() => {
    if (!channelId || !nextPageState || loadingMore) return;
    setLoadingMore(true);
    const moreUrl = "/api/data/channels/" + channelId +
      "/messages?limit=" + String(PAGE_SIZE) +
      "&pageState=" + encodeURIComponent(nextPageState);
    fetch(moreUrl)
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + String(res.status));
        return res.json() as Promise<MessagesResponse>;
      })
      .then(({ messages: older, nextPageState: nps }) => {
        setMessages((prev) => [...older.reverse(), ...prev]);
        setNextPageState(nps);
      })
      .catch((err: unknown) => {
        console.error("[MessageList] loadMore error", err);
      })
      .finally(() => setLoadingMore(false));
  }, [channelId, nextPageState, loadingMore]);

  if (!channelId) {
    return (
      <div style={styles.empty}>
        <p>Select a channel to view messages.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={styles.empty}><p>Loading messages…</p></div>;
  }

  return (
    <div style={styles.container}>
      {nextPageState && (
        <div style={styles.loadMoreWrapper}>
          <button onClick={loadMore} disabled={loadingMore} style={styles.loadMoreBtn}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
      <ul style={styles.list}>
        {messages.length === 0 && (
          <li style={styles.emptyItem}>No messages yet. Say something!</li>
        )}
        {messages.map((msg) => (
          <li key={msg.message_id} style={styles.item}>
            <span style={styles.author}>{msg.author_id}</span>
            <span style={styles.content}>{msg.content}</span>
            <span style={styles.timestamp}>
              {new Date(msg.created_at).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", flex: 1, overflowY: "auto", padding: "8px 16px" },
  empty: { display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#888" },
  loadMoreWrapper: { display: "flex", justifyContent: "center", padding: "8px 0" },
  loadMoreBtn: { padding: "4px 16px", cursor: "pointer" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px" },
  emptyItem: { color: "#888", fontStyle: "italic" },
  item: { display: "flex", gap: "8px", alignItems: "baseline" },
  author: { fontWeight: 700, minWidth: "80px", color: "#5865f2" },
  content: { flex: 1, wordBreak: "break-word" },
  timestamp: { fontSize: "0.75rem", color: "#888", whiteSpace: "nowrap" },
};
