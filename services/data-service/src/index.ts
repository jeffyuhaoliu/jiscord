import Fastify from 'fastify';
import { client, connect } from './db/client';
import { UserRepository } from './repositories/UserRepository';

const server = Fastify({ logger: true });
const userRepo = new UserRepository();

server.get('/health', async (_req, reply) => {
  const state = client.getState();
  const connected = state.getConnectedHosts().length > 0;
  if (!connected) {
    return reply.status(503).send({ status: 'unavailable', db: 'disconnected' });
  }
  return { status: 'ok', db: 'connected' };
});

// --- User routes ---

server.post<{ Body: { username: string; email: string; password_hash: string } }>(
  '/users',
  async (req, reply) => {
    const { username, email, password_hash } = req.body;
    const existing = await userRepo.getUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' });
    }
    const user = await userRepo.createUser(username, email, password_hash);
    return reply.status(201).send(user);
  },
);

server.get<{ Params: { id: string } }>('/users/:id', async (req, reply) => {
  const user = await userRepo.getUserById(req.params.id);
  if (!user) return reply.status(404).send({ error: 'User not found' });
  return user;
});

server.get<{ Params: { email: string } }>('/users/email/:email', async (req, reply) => {
  const user = await userRepo.getUserByEmail(req.params.email);
  if (!user) return reply.status(404).send({ error: 'User not found' });
  return user;
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
