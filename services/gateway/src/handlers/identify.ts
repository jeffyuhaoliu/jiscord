import { WebSocket } from 'ws';
import { clients, userSessions } from '../state';
import { OpCode, GatewayPayload, IdentifyData, ReadyData } from '../protocol';

export function handleIdentify(ws: WebSocket, sessionId: string, data: IdentifyData): void {
  const { userId, token } = data;

  // TODO: validate token against auth service when auth service exists
  // For now, accept any non-empty userId
  if (!userId) {
    const invalid: GatewayPayload<null> = { op: OpCode.INVALID_SESSION, d: null };
    ws.send(JSON.stringify(invalid));
    ws.close();
    return;
  }

  const client = clients.get(sessionId);
  if (!client) return;

  // Evict existing session for same userId (single-session per user for now)
  const existingSession = userSessions.get(userId);
  if (existingSession && existingSession !== sessionId) {
    const existing = clients.get(existingSession);
    if (existing) {
      const invalid: GatewayPayload<null> = { op: OpCode.INVALID_SESSION, d: null };
      existing.ws.send(JSON.stringify(invalid));
      existing.ws.close();
    }
  }

  client.userId = userId;
  userSessions.set(userId, sessionId);

  const ready: GatewayPayload<ReadyData> = {
    op: OpCode.READY,
    d: { userId, sessionId },
  };
  ws.send(JSON.stringify(ready));
  console.log(`[identify] User ${userId} identified as session ${sessionId}`);
}
