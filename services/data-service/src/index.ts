import Fastify from "fastify";
import { client, connect } from "./db/client";
import { MessageRepository } from "./repositories/MessageRepository";

const server = Fastify({ logger: true });
const messageRepo = new MessageRepository();

server.get("/health", async (_req, reply) => {
  const state = client.getState();
  const connected = state.getConnectedHosts().length > 0;
  if (!connected) {
    return reply.status(503).send({ status: "unavailable", db: "disconnected" });
  }
  return { status: "ok", db: "connected" };
});

interface GetMessagesParams { channelId: string }
interface GetMessagesQuery { pageSize?: string; pageState?: string }
server.get<{ Params: GetMessagesParams, Querystring: GetMessagesQuery }>(
  "/channels/:channelId/messages",
  async (req, reply) => {
    const { channelId } = req.params
    const rawSize = req.query.pageSize
    const parsedSize = parseInt(rawSize ?? "50", 10)
    const pageSize = Math.min(isNaN(parsedSize) ? 50 : parsedSize, 100)
    const pageState = req.query.pageState
    try {
      const result = await messageRepo.getMessages(channelId, pageSize, pageState)
      return result
    } catch (err) {
      server.log.error(err)
      return reply.status(500).send({ error: "Internal server error" })
    }
  }
)

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
