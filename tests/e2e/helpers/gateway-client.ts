import WebSocket from "ws";

const GATEWAY_URL = "ws://localhost:3002";
const HEARTBEAT_INTERVAL = 30_000;

type Callback = (data: unknown) => void;

export class GatewayClient {
  private ws: WebSocket;
  private listeners = new Map<string, Set<Callback>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private ready = false;

  constructor(private token: string) {
    this.ws = new WebSocket(GATEWAY_URL);
    this.ws.on("message", (raw) => this.handleMessage(raw.toString()));
    this.ws.on("error", (err) => {
      console.error("[GatewayClient] WebSocket error:", err.message);
    });
  }

  private handleMessage(raw: string): void {
    let payload: { op: string; d: unknown };
    try {
      payload = JSON.parse(raw) as { op: string; d: unknown };
    } catch {
      return;
    }

    if (payload.op === "HELLO") {
      // Identify with token only — gateway derives userId internally
      this.ws.send(
        JSON.stringify({ op: "IDENTIFY", d: { token: this.token } })
      );
    }

    if (payload.op === "READY") {
      this.ready = true;
      // Start heartbeat
      this.heartbeatTimer = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ op: "HEARTBEAT", d: null }));
        }
      }, HEARTBEAT_INTERVAL);
    }

    const cbs = this.listeners.get(payload.op);
    cbs?.forEach((cb) => cb(payload.d));
  }

  on(op: string, cb: Callback): () => void {
    if (!this.listeners.has(op)) this.listeners.set(op, new Set());
    this.listeners.get(op)!.add(cb);
    return () => this.listeners.get(op)?.delete(cb);
  }

  waitFor(op: string, timeoutMs = 10_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for op ${op} after ${timeoutMs}ms`));
      }, timeoutMs);

      const off = this.on(op, (data) => {
        clearTimeout(timer);
        off();
        resolve(data);
      });
    });
  }

  send(op: string, d: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op, d }));
    } else {
      throw new Error(`[GatewayClient] Cannot send — WS not open (state: ${this.ws.readyState})`);
    }
  }

  /** Wait until READY is received before returning */
  async connect(): Promise<void> {
    if (this.ready) return;
    await this.waitFor("READY", 15_000);
  }

  close(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.ws.close();
  }
}
