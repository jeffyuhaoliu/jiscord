import { useCallback, useEffect, useRef, useState } from "react";
import type { TypingStartPayload } from "../../hooks/useGateway";
import type { useGateway } from "../../hooks/useGateway";

type GatewayHook = ReturnType<typeof useGateway>;

interface Props {
  channelId: string | null;
  send: GatewayHook["send"];
  on: GatewayHook["on"];
}

const TYPING_THROTTLE_MS = 2000;

export function MessageInput({ channelId, send, on }: Props) {
  const [content, setContent] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const lastTypingRef = useRef<number>(0);

  // Listen for TYPING_START events on this channel
  useEffect(() => {
    const off = on("TYPING_START", (payload: TypingStartPayload) => {
      if (payload.channelId !== channelId) return;
      setTypingUsers((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId]
      );
      // Clear after 3 s
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== payload.userId));
      }, 3000);
    });
    return off;
  }, [channelId, on]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = content.trim();
        if (!trimmed || !channelId) return;
        send("SEND_MESSAGE", { channelId, content: trimmed });
        setContent("");
      }
    },
    [content, channelId, send]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      if (!channelId) return;
      const now = Date.now();
      if (now - lastTypingRef.current > TYPING_THROTTLE_MS) {
        lastTypingRef.current = now;
        send("TYPING_START", { channelId });
      }
    },
    [channelId, send]
  );

  return (
    <div style={styles.wrapper}>
      {typingUsers.length > 0 && (
        <div style={styles.typing}>
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing\u2026
        </div>
      )}
      <textarea
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={channelId ? "Message #channel" : "Select a channel first"}
        disabled={!channelId}
        rows={1}
        style={styles.textarea}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "4px" },
  typing: { fontSize: "0.75rem", color: "#b9bbbe", minHeight: "16px" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "10px 14px", background: "#40444b", border: "none", borderRadius: "8px", color: "#dcddde", fontSize: "1rem", resize: "none", outline: "none", fontFamily: "inherit" },
};
