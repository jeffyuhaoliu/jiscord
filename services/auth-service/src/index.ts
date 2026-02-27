import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authRoutes } from './routes/auth';

const PORT = parseInt(process.env.PORT ?? '3003', 10);
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-prod';

const server = Fastify({ logger: true });

server.register(fastifyJwt, {
  secret: JWT_SECRET,
  sign: { expiresIn: '7d' },
});

// Decorate server with authenticate hook for protected routes
server.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    await req.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
});

server.get('/health', async () => {
  return { status: 'ok' };
});

server.register(authRoutes);

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
