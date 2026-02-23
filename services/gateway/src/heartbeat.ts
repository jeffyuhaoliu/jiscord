import { WebSocket } from 'ws';
import { clients, removeClient } from './state';
import { OpCode, GatewayPayload, HelloData } from './protocol';

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = HEARTBEAT_INTERVAL * 1.5;

export function sendHello(ws: WebSocket): void {
  const payload: GatewayPayload<HelloData> = {
    op: OpCode.HELLO,
    d: { heartbeat_interval: HEARTBEAT_INTERVAL },
  };
  ws.send(JSON.stringify(payload));
}

export function startHeartbeatMonitor(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, client] of clients) {
      if (now - client.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log(`[heartbeat] Session ${sessionId} timed out, closing`);
        client.ws.terminate();
        removeClient(sessionId);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

export function handleHeartbeat(sessionId: string): void {
  const client = clients.get(sessionId);
  if (!client) return;

  client.lastHeartbeat = Date.now();

  const ack: GatewayPayload<null> = { op: OpCode.HEARTBEAT_ACK, d: null };
  client.ws.send(JSON.stringify(ack));
}
