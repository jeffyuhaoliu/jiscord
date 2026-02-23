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
