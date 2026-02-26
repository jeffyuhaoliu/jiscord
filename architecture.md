# Jiscord Architecture

A Discord-like chat application built with TypeScript microservices.

## Services

| Service | Port | Responsibility |
|---|---|---|
| `data-service` | 3001 | ScyllaDB persistence layer |
| `auth-service` | 3003 | JWT authentication |
| `gateway` | 3002 | WebSocket real-time layer |
| `apps/web` | 5173 | React frontend |

## Infrastructure

- **ScyllaDB** (port 9042) — primary data store, all message/user/guild persistence
- **Redis** (port 6379) — pub/sub for real-time fan-out between gateway instances
- **Docker Compose** — runs all services and infrastructure locally

---

## Service Details

### data-service (port 3001)

Fastify HTTP service. The only process that touches ScyllaDB directly. All other services go through this API.

**Repositories:**
- `UserRepository` — DataLoader-based batching for user lookups (`batchGetById`, `getUserByEmail`, `createUser`)
- `MessageRepository` — cursor-paginated message reads, timeuuid-based message IDs
- `GuildRepository` — guild membership lookups
- `ChannelRepository` — channel listing by guild

**HTTP API:**
```
GET  /health
POST /users                        — create user (409 if email exists)
GET  /users/:userId                — get user by ID
GET  /users/email/:email           — get user by email
GET  /channels/:channelId/messages — paginated messages (cursor via pageState)
POST /channels/:channelId/messages — persist message, returns MessageRow
GET  /guilds/me                    — guilds for user (X-User-ID header)
GET  /guilds/:guildId/channels     — channels in a guild
```

**Key constraint:** Uses DataLoader pattern on `UserRepository` to coalesce concurrent user lookups into a single `WHERE user_id IN ?` query.

---

### auth-service (port 3003)

Fastify HTTP service. Handles registration, login, and token verification. Never touches ScyllaDB — delegates all user CRUD to data-service.

**HTTP API:**
```
POST /register        — hash password, create user via data-service
POST /login           — verify password, issue JWT (7-day expiry)
GET  /me              — return current user (requires Bearer token)
POST /verify-token    — validate JWT, return { sub, username } (called by gateway)
```

**JWT:** HS256, secret from `JWT_SECRET` env var. Payload: `{ sub: user_id, username }`.

---

### gateway (port 3002)

WebSocket server (ws library) attached to a Fastify HTTP server. Implements a Discord-like gateway protocol over WebSocket. Uses Redis pub/sub to fan out messages to all subscribers of a channel.

**Protocol (op codes):**
```
S→C  HELLO          { heartbeat_interval: 45000 }
C→S  IDENTIFY       { token: string }
S→C  READY          { userId, sessionId }
C→S  HEARTBEAT      null
S→C  HEARTBEAT_ACK  null
C→S  SEND_MESSAGE   { channelId, content }
S→C  MESSAGE_CREATE { messageId, channelId, authorId, content, createdAt }
C→S  TYPING_START   { channelId }
S→C  TYPING         { channelId, userId, timestamp }
S→C  INVALID_SESSION null  — sent before closing bad sessions
```

**Connection flow:**
1. Client connects → gateway sends `HELLO` with heartbeat interval
2. Client sends `IDENTIFY` with JWT token
3. Gateway validates token via `POST auth-service/verify-token`
4. Gateway sends `READY` with userId and sessionId

**Message flow (SEND_MESSAGE):**
1. Gateway calls `POST data-service/channels/:channelId/messages`
2. Data-service persists and returns `MessageRow`
3. Gateway publishes `MESSAGE_CREATE` event to Redis channel key `channel:<channelId>`
4. Redis subscriber in each gateway instance fans out to all WebSocket clients subscribed to that channel

**Session management:**
- Single session per user — new IDENTIFY evicts the old session with `INVALID_SESSION`
- Heartbeat monitor closes sessions that stop sending heartbeats

---

### apps/web (Vite + React)

React SPA. Communicates with services directly (no API gateway yet).

**Key files:**
- `src/hooks/useGateway.ts` — WebSocket client hook; handles HELLO→IDENTIFY handshake, heartbeat, and event dispatch
- `src/context/AuthContext.tsx` — JWT token storage and auth state
- `src/pages/ChannelsPage.tsx` — main chat UI
- `src/components/` — MessageList, MessageInput, GuildSidebar, ChannelList

**Auth flow:** On login, stores JWT in context. `useGateway` sends the token in `IDENTIFY`. `RequireAuth` wrapper redirects unauthenticated users to `/login`.

---

## Data Model (ScyllaDB)

### `users`
```cql
PRIMARY KEY (user_id)
```
- `user_id uuid`, `username text`, `email text`, `password_hash text`, `created_at timestamp`

### `users_by_email`
```cql
PRIMARY KEY (email)
```
- Lookup table for login. Written atomically alongside `users`.

### `messages`
```cql
PRIMARY KEY (channel_id, message_id)  -- message_id is timeuuid
CLUSTERING ORDER BY (message_id DESC)
```
- Partition by channel, ordered by time. Cursor pagination via ScyllaDB `pageState`.

### `guilds` / `guild_members` / `channels`
- Guild and channel metadata, membership stored separately.

---

## Service Communication

```
apps/web
  │
  ├─ HTTP ──► auth-service:3003  (login, register, /me)
  ├─ HTTP ──► data-service:3001  (messages, guilds, channels)
  └─ WS   ──► gateway:3002       (real-time events)

auth-service:3003
  └─ HTTP ──► data-service:3001  (user CRUD)

gateway:3002
  ├─ HTTP ──► auth-service:3003  (POST /verify-token on IDENTIFY)
  ├─ HTTP ──► data-service:3001  (POST /channels/:id/messages)
  └─ Redis pub/sub ◄──────────── fan-out MESSAGE_CREATE / TYPING events
```

---

## What Is Not Yet Built

- **API Gateway / reverse proxy** — frontend calls each service directly; no unified entrypoint
- **Guild/channel creation** — read paths exist, no write paths for guilds or channels
- **Member management** — no join/leave guild flows
- **Message editing/deletion**
- **Direct messages**
- **File/image uploads**
- **Presence** (online/offline status)
- **End-to-end tests**
