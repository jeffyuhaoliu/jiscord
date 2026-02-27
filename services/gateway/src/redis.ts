import Redis from 'ioredis';
import { clients, channelSubscribers } from './state';
import { OpCode, GatewayPayload } from './protocol';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const CHANNEL_PREFIX = 'jiscord:channel:';

// Separate publisher and subscriber clients (ioredis requirement for pub/sub)
export const publisher = new Redis(REDIS_URL);
publisher.on('error', (err) => console.error('[redis] publisher error:', err));
export const subscriber = new Redis(REDIS_URL);
subscriber.on('error', (err) => console.error('[redis] subscriber error:', err));

export async function publishToChannel(channelId: string, payload: { event: string; data: unknown }): Promise<void> {
  await publisher.publish(`${CHANNEL_PREFIX}${channelId}`, JSON.stringify(payload));
}

export function startRedisSubscriber(): void {
  // Pattern subscribe to all jiscord channel topics - avoids per-channel subscribe management
  subscriber.psubscribe(`${CHANNEL_PREFIX}*`, (err) => {
    if (err) console.error('[redis] psubscribe error:', err);
    else console.log(`[redis] Pattern subscribed to ${CHANNEL_PREFIX}*`);
  });

  subscriber.on('pmessage', (_pattern: string, redisChannel: string, message: string) => {
    const channelId = redisChannel.replace(CHANNEL_PREFIX, '');

    let payload: { event: string; data: unknown };
    try {
      payload = JSON.parse(message);
    } catch {
      console.error('[redis] Failed to parse message:', message);
      return;
    }

    // Determine opcode
    let op: OpCode;
    if (payload.event === 'MESSAGE_CREATE') {
      op = OpCode.MESSAGE_CREATE;
    } else if (payload.event === 'TYPING') {
      op = OpCode.TYPING;
    } else {
      console.warn('[redis] Unknown event:', payload.event);
      return;
    }

    const wsPayload: GatewayPayload<unknown> = { op, d: payload.data };
    const wsMessage = JSON.stringify(wsPayload);

    // Fan-out to all WebSocket clients subscribed to this channel
    const sessionIds = channelSubscribers.get(channelId);
    if (!sessionIds) return;

    for (const sessionId of sessionIds) {
      const client = clients.get(sessionId);
      if (client && client.ws.readyState === 1 /* OPEN */) {
        client.ws.send(wsMessage, (err) => { if (err) console.error('[redis] ws.send error for session', sessionId, err); });
      }
    }
  });
}
