import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import axios from 'axios';

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL ?? 'http://localhost:3001';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface DataUser {
  user_id: string;
  username: string;
  email: string;
  created_at: string;
}

interface VerifyPasswordResponse {
  valid: boolean;
  user: DataUser;
}

async function dataGet<T>(path: string): Promise<T | null> {
  try {
    const res = await axios.get<T>(`${DATA_SERVICE_URL}${path}`);
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

async function dataPost<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await axios.post<T>(`${DATA_SERVICE_URL}${path}`, body);
  return { status: res.status, data: res.data };
}

export async function authRoutes(server: FastifyInstance): Promise<void> {
  // POST /register
  server.post<{ Body: RegisterBody }>('/register', async (req: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
    const { username, email, password } = req.body ?? {};

    if (!username || username.length < 2 || username.length > 32) {
      return reply.status(400).send({ error: 'username must be 2-32 chars' });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return reply.status(400).send({ error: 'invalid email' });
    }
    if (!password || password.length < 8) {
      return reply.status(400).send({ error: 'password must be at least 8 chars' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    try {
      const { data: user } = await dataPost<DataUser>('/users', {
        username,
        email,
        password_hash,
      });
      return reply.status(201).send({ user_id: user.user_id, username: user.username });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        return reply.status(409).send({ error: 'Email already in use' });
      }
      throw err;
    }
  });

  // POST /login
  server.post<{ Body: LoginBody }>('/login', async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    let verifyResult: VerifyPasswordResponse | null = null;
    try {
      const { data } = await dataPost<VerifyPasswordResponse>(`/users/email/${encodeURIComponent(email)}/verify-password`, { password });
      verifyResult = data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      throw err;
    }

    if (!verifyResult.valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = verifyResult.user;
    const token = server.jwt.sign({ sub: user.user_id, username: user.username });
    return reply.send({
      token,
      user: { user_id: user.user_id, username: user.username, email: user.email },
    });
  });

  // GET /me — requires JWT
  server.get('/me', {
    preHandler: [server.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string; username: string };
    const user = await dataGet<DataUser>(`/users/${payload.sub}`);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return { user_id: user.user_id, username: user.username, email: user.email };
  });

  // POST /verify-token — internal use by Gateway
  server.post('/verify-token', async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing token' });
    }
    const token = authHeader.slice(7);
    try {
      const payload = server.jwt.verify<{ sub: string; username: string }>(token);
      return reply.send({ sub: payload.sub, username: payload.username });
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
}
