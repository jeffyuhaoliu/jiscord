import Fastify from 'fastify';
import { client, connect } from './db/client';

const server = Fastify({ logger: true });

server.get('/health', async (_req, reply) => {
  const state = client.getState();
  const connected = state.getConnectedHosts().length > 0;
  if (!connected) {
    return reply.status(503).send({ status: 'unavailable', db: 'disconnected' });
  }
  return { status: 'ok', db: 'connected' };
});

const start = async () => {
  try {
    await connect();
    server.log.info('ScyllaDB connected');
    await server.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
