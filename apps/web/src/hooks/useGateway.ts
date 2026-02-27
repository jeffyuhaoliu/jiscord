import { useEffect, useRef, useCallback } from "react";

export interface MessageCreatePayload {
  messageId: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface TypingStartPayload {
  channelId: string;
  userId: string;
}

type EventCallback<T> = (data: T) => void;

type EventMap = {
  MESSAGE_CREATE: MessageCreatePayload;
  TYPING: TypingStartPayload;
};

export function useGateway(url: string, token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback<unknown>>>>(new Map());

  const on = useCallback(<K extends keyof EventMap>(
    event: K,
    cb: EventCallback<EventMap[K]>
  ) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(cb as EventCallback<unknown>);
    return () => {
      listenersRef.current.get(event)?.delete(cb as EventCallback<unknown>);
    };
  }, []);

  const send = useCallback((op: string, d: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ op, d }));
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    ws.onmessage = (ev) => {
      let payload: { op: string; d: unknown };
      try {
        payload = JSON.parse(ev.data as string) as { op: string; d: unknown };
      } catch {
        return;
      }

      if (payload.op === "HELLO") {
        const hello = payload.d as { heartbeat_interval: number };
        ws.send(JSON.stringify({ op: "IDENTIFY", d: { token } }));
        heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: "HEARTBEAT", d: null }));
          }
        }, hello.heartbeat_interval);
      }

      const listeners = listenersRef.current.get(payload.op);
      listeners?.forEach((cb) => cb(payload.d));
    };

    ws.onerror = (err) => {
      console.error("[useGateway] WebSocket error", err);
    };

    return () => {
      if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
      ws.close();
      wsRef.current = null;
    };
  }, [url, token]);

  return { on, send };
}
