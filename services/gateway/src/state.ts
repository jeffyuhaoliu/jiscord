import { WebSocket } from 'ws';

export interface ClientState {
  ws: WebSocket;
  userId: string | null;
  sessionId: string;
  lastHeartbeat: number;
  subscribedChannels: Set<string>;
}

// Map of sessionId -> ClientState
export const clients = new Map<string, ClientState>();

// Map of userId -> sessionId (for direct lookup)
export const userSessions = new Map<string, string>();

// Map of channelId -> Set<sessionId>
export const channelSubscribers = new Map<string, Set<string>>();

export function addChannelSubscriber(channelId: string, sessionId: string): void {
  if (!channelSubscribers.has(channelId)) {
    channelSubscribers.set(channelId, new Set());
  }
  channelSubscribers.get(channelId)!.add(sessionId);
}

export function removeClient(sessionId: string): void {
  const client = clients.get(sessionId);
  if (!client) return;

  if (client.userId) {
    userSessions.delete(client.userId);
  }

  for (const channelId of client.subscribedChannels) {
    const subs = channelSubscribers.get(channelId);
    if (subs) {
      subs.delete(sessionId);
      if (subs.size === 0) channelSubscribers.delete(channelId);
    }
  }

  clients.delete(sessionId);
}
