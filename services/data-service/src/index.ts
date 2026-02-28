import Fastify from "fastify";
import bcrypt from "bcrypt";
import { client, connect } from "./db/client";
import { MessageRepository } from "./repositories/MessageRepository";
import { GuildRepository } from "./repositories/GuildRepository";
import { ChannelRepository } from "./repositories/ChannelRepository";
import { UserRepository } from "./repositories/UserRepository";

const server = Fastify({ logger: true });
const messageRepo = new MessageRepository();
const guildRepo = new GuildRepository();
const channelRepo = new ChannelRepository();
const userRepo = new UserRepository();

server.get("/health", async (_req, reply) => {
  const state = client.getState();
  const connected = state.getConnectedHosts().length > 0;
  if (!connected) {
    return reply.status(503).send({ status: "unavailable", db: "disconnected" });
  }
  return { status: "ok", db: "connected" };
});

interface GetMessagesParams { channelId: string }
interface GetMessagesQuery { limit?: string; pageState?: string }
server.get<{ Params: GetMessagesParams, Querystring: GetMessagesQuery }>(
  "/channels/:channelId/messages",
  async (req, reply) => {
    const { channelId } = req.params;
    const rawLimit = req.query.limit;
    const parsedLimit = parseInt(rawLimit ?? "50", 10);
    const limit = isNaN(parsedLimit) ? 50 : parsedLimit;
    const pageState = req.query.pageState;
    try {
      const result = await messageRepo.getByChannel({ channel_id: channelId, pageState, limit });
      return result;
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }
);

interface PostMessageParams { channelId: string }
interface PostMessageBody { author_id: string; content: string }
server.post<{ Params: PostMessageParams; Body: PostMessageBody }>(
  "/channels/:channelId/messages",
  async (req, reply) => {
    const { channelId } = req.params;
    const { author_id, content } = req.body;
    if (!author_id || !content) {
      return reply.status(400).send({ error: "author_id and content are required" });
    }
    try {
      const message = await messageRepo.insertMessage({ channel_id: channelId, author_id, content });
      return reply.status(201).send(message);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// GET /guilds — list all guilds (for browser/discovery UI)
server.get("/guilds", async (_req, reply) => {
  try {
    const guilds = await guildRepo.getAll();
    return guilds.map((g) => ({
      guild_id: g.guild_id,
      name: g.name,
      created_at: g.created_at,
    }));
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// GET /guilds/me — fetch guilds for authenticated user (user_id via X-User-ID header)
server.get("/guilds/me", async (req, reply) => {
  const userId = (req.headers["x-user-id"] as string | undefined)?.trim();
  if (!userId) {
    return reply.status(400).send({ error: "X-User-ID header required" });
  }
  try {
    const guilds = await guildRepo.getGuildsForUser(userId);
    return guilds.map((g) => ({
      guild_id: g.guild_id,
      name: g.name,
      created_at: g.created_at,
    }));
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// POST /guilds — create a guild and auto-join the creator
interface PostGuildBody { name: string; creator_user_id: string }
server.post<{ Body: PostGuildBody }>("/guilds", async (req, reply) => {
  const { name, creator_user_id } = req.body;
  if (!name || !creator_user_id) {
    return reply.status(400).send({ error: "name and creator_user_id are required" });
  }
  try {
    const { types } = await import("cassandra-driver");
    const guildId = types.Uuid.random().toString();
    const guild = await guildRepo.createGuild(guildId, name);
    await guildRepo.joinGuild(guildId, creator_user_id);
    return reply.status(201).send({ guild_id: guild.guild_id, name: guild.name, created_at: guild.created_at });
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// POST /guilds/:guildId/members — join a guild
interface PostMemberParams { guildId: string }
interface PostMemberBody { user_id: string }
server.post<{ Params: PostMemberParams; Body: PostMemberBody }>("/guilds/:guildId/members", async (req, reply) => {
  const { guildId } = req.params;
  const { user_id } = req.body;
  if (!user_id) {
    return reply.status(400).send({ error: "user_id is required" });
  }
  try {
    const guild = await guildRepo.getGuildById(guildId);
    if (!guild) return reply.status(404).send({ error: "Guild not found" });
    const member = await guildRepo.joinGuild(guildId, user_id);
    return reply.status(201).send({ guild_id: member.guild_id, user_id: member.user_id, joined_at: member.joined_at });
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// POST /guilds/:guildId/channels — create a channel in a guild
interface PostChannelParams { guildId: string }
interface PostChannelBody { name: string }
server.post<{ Params: PostChannelParams; Body: PostChannelBody }>("/guilds/:guildId/channels", async (req, reply) => {
  const { guildId } = req.params;
  const { name } = req.body;
  if (!name) {
    return reply.status(400).send({ error: "name is required" });
  }
  try {
    const guild = await guildRepo.getGuildById(guildId);
    if (!guild) return reply.status(404).send({ error: "Guild not found" });
    const { types } = await import("cassandra-driver");
    const channelId = types.Uuid.random().toString();
    const channel = await channelRepo.createChannel(guildId, channelId, name);
    return reply.status(201).send({ channel_id: channel.channel_id, guild_id: channel.guild_id, name: channel.name, created_at: channel.created_at });
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// GET /guilds/:guildId/channels — list channels for a guild
interface GetChannelsParams { guildId: string }
server.get<{ Params: GetChannelsParams }>("/guilds/:guildId/channels", async (req, reply) => {
  const { guildId } = req.params;
  try {
    const channels = await channelRepo.getChannelsByGuild(guildId);
    return channels.map((c) => ({
      channel_id: c.channel_id,
      guild_id: c.guild_id,
      name: c.name,
      created_at: c.created_at,
    }));
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// POST /users — create a new user (called by auth-service during registration)
interface PostUserBody { username: string; email: string; password_hash: string }
server.post<{ Body: PostUserBody }>("/users", async (req, reply) => {
  const { username, email, password_hash } = req.body;
  if (!username || !email || !password_hash) {
    return reply.status(400).send({ error: "username, email, and password_hash are required" });
  }
  try {
    const existing = await userRepo.getUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: "Email already in use" });
    }
    const user = await userRepo.createUser({ username, email, passwordHash: password_hash });
    const { password_hash: _, ...safeUser } = user;
    return reply.status(201).send(safeUser);
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// GET /users/email/:email — look up a user by email (password_hash stripped)
interface GetUserByEmailParams { email: string }
server.get<{ Params: GetUserByEmailParams }>("/users/email/:email", async (req, reply) => {
  const { email } = req.params;
  try {
    const user = await userRepo.getUserByEmail(decodeURIComponent(email));
    if (!user) return reply.status(404).send({ error: "User not found" });
    const { password_hash: _, ...safe } = user;
    return safe;
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// POST /users/email/:email/verify-password — internal: verify plaintext password against stored hash
interface VerifyPasswordBody { password: string }
server.post<{ Params: GetUserByEmailParams; Body: VerifyPasswordBody }>("/users/email/:email/verify-password", async (req, reply) => {
  const { email } = req.params;
  const { password } = req.body;
  if (!password) {
    return reply.status(400).send({ error: "password is required" });
  }
  try {
    const user = await userRepo.getUserByEmail(decodeURIComponent(email));
    if (!user) return reply.status(404).send({ error: "User not found" });
    const valid = await bcrypt.compare(password, user.password_hash);
    const { password_hash: _, ...safeUser } = user;
    return { valid, user: safeUser };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

// GET /users/:userId — fetch a user by ID (called by auth-service for GET /me)
interface GetUserParams { userId: string }
server.get<{ Params: GetUserParams }>("/users/:userId", async (req, reply) => {
  const { userId } = req.params;
  try {
    const [user] = await userRepo.batchGetById([userId]);
    if (!user) return reply.status(404).send({ error: "User not found" });
    const { password_hash: _, ...safe } = user;
    return safe;
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

const start = async () => {
  try {
    await connect()
    server.log.info("ScyllaDB connected")
    await server.listen({ port: 3001, host: "0.0.0.0" })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
