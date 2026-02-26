import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { clients, removeClient } from './state';
import { sendHello, startHeartbeatMonitor, handleHeartbeat } from './heartbeat';
import { handleIdentify } from './handlers/identify';
import { handleSendMessage } from './handlers/sendMessage';
import { handleTypingStart } from './handlers/typingStart';
import { startRedisSubscriber, publisher } from './redis';
import { OpCode, GatewayPayload } from './protocol';

const PORT = parseInt(process.env.PORT ?? '3002', 10);

const fastify = Fastify({ logger: true });

// Health endpoint
fastify.get('/health', async (_req, reply) => {
  const wsClientCount = clients.size;
  try {
    await publisher.ping();
    return { status: 'ok', ws_clients: wsClientCount, redis: 'connected' };
  } catch {
    return reply.status(503).send({ status: 'unavailable', redis: 'disconnected' });
  }
});

// WebSocket server attached to Fastify's underlying HTTP server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
  const sessionId = randomUUID();

  clients.set(sessionId, {
    ws,
    userId: null,
    sessionId,
    lastHeartbeat: Date.now(),
    subscribedChannels: new Set(),
  });

  console.log(`[gateway] New connection: session ${sessionId}`);

  // Send HELLO immediately on connect
  sendHello(ws);

  ws.on('message', async (raw) => {
    let payload: GatewayPayload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      console.warn(`[gateway] Invalid JSON from session ${sessionId}`);
      return;
    }

    const { op, d } = payload;

    switch (op) {
      case OpCode.HEARTBEAT:
        handleHeartbeat(sessionId);
        break;
      case OpCode.IDENTIFY:
        await handleIdentify(ws, sessionId, d as any);
        break;
      case OpCode.SEND_MESSAGE:
        await handleSendMessage(sessionId, d as any);
        break;
      case OpCode.TYPING_START:
        await handleTypingStart(sessionId, d as any);
        break;
      default:
        console.warn(`[gateway] Unknown opcode: ${op}`);
    }
  });

  ws.on('close', () => {
    console.log(`[gateway] Session ${sessionId} disconnected`);
    removeClient(sessionId);
  });

  ws.on('error', (err) => {
    console.error(`[gateway] Error on session ${sessionId}:`, err);
    removeClient(sessionId);
  });
});

const start = async () => {
  try {
    startRedisSubscriber();
    startHeartbeatMonitor();

    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    // Attach WebSocket upgrade handler after server is listening
    fastify.server.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });

    fastify.log.info(`Gateway running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
