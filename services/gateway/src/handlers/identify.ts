import axios from 'axios';
import { WebSocket } from 'ws';
import { clients, userSessions } from '../state';
import { OpCode, GatewayPayload, IdentifyData, ReadyData } from '../protocol';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3003';

export async function handleIdentify(ws: WebSocket, sessionId: string, data: IdentifyData): Promise<void> {
  const { token } = data;

  const reject = () => {
    const invalid: GatewayPayload<null> = { op: OpCode.INVALID_SESSION, d: null };
    ws.send(JSON.stringify(invalid));
    ws.close();
  };

  if (!token) {
    reject();
    return;
  }

  let userId: string;
  try {
    const res = await axios.post<{ sub: string; username: string }>(
      `${AUTH_SERVICE_URL}/verify-token`,
      null,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    userId = res.data.sub;
  } catch {
    console.warn(`[identify] Token validation failed for session ${sessionId}`);
    reject();
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
