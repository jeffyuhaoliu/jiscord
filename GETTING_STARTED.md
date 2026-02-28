# Getting Started with Jiscord

Jiscord is a Discord-like real-time chat application. This guide covers two perspectives: **running the stack** (operator) and **using the app** (end user).

---

## Part 1: Running Jiscord (Operator Guide)

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) v18+ and npm
- Ports 3001, 3002, 3003, 5173, 6379, and 9042 available

### Architecture Overview

Jiscord is composed of four services:

| Service       | Port | Purpose                                         |
|---------------|------|-------------------------------------------------|
| data-service  | 3001 | Reads/writes to ScyllaDB (the only DB accessor) |
| auth-service  | 3003 | Registration, login, JWT issuance               |
| gateway       | 3002 | WebSocket server; real-time message delivery    |
| web (frontend)| 5173 | React SPA (Vite dev server)                     |

Plus two infrastructure dependencies:

| Dependency | Port | Purpose                              |
|------------|------|--------------------------------------|
| ScyllaDB   | 9042 | Primary data store (messages, users, guilds) |
| Redis      | 6379 | Pub/Sub fan-out for real-time events |

### Step 1: Clone and install dependencies

```bash
git clone <repo-url>
cd jiscord
```

Install frontend dependencies (the backend services install via Docker):

```bash
cd apps/web && npm install && cd ../..
```

### Step 2: Start the backend stack

```bash
docker-compose up
```

This starts ScyllaDB, Redis, data-service, auth-service, and the gateway — all in one command. On first run, ScyllaDB takes about 30–60 seconds to become ready before the data-service can connect.

To verify everything is up, check the health endpoints:

```bash
curl http://localhost:3001/health   # data-service + ScyllaDB
curl http://localhost:3003/health   # auth-service
curl http://localhost:3002/health   # gateway + Redis + WebSocket
```

All three should return `{"status":"ok"}` (or similar).

### Step 3: Run database migrations

Jiscord uses CQL schema files to set up the ScyllaDB keyspace and tables. Run them once after the database is initialized:

```bash
# Connect to ScyllaDB and apply each migration in order
docker exec -i jiscord-scylladb-1 cqlsh < migrations/001_users.cql
docker exec -i jiscord-scylladb-1 cqlsh < migrations/002_messages.cql
docker exec -i jiscord-scylladb-1 cqlsh < migrations/003_guilds.cql
```

> The exact container name may differ. Run `docker ps` to find the ScyllaDB container name.

### Step 4: Seed initial data

Run the seed script to create a demo user, a "General" guild, and a "general" channel:

```bash
cd services/data-service
npm install
npm run seed
```

The seed script is idempotent — it is safe to run multiple times. It will skip any resources that already exist.

**Demo credentials created by the seed:**
- Email: `demo@example.com`
- Password: `password123`

> The seed script requires auth-service (port 3003) and data-service (port 3001) to be running. Start them via `docker-compose up` first.

### Step 5: Start the frontend

In a separate terminal:

```bash
cd apps/web
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

The services are pre-configured for local Docker Compose use. For custom deployments, the key variables are:

**auth-service:**
- `JWT_SECRET` — **Required.** Secret key for signing tokens. The service will refuse to start if this is not set.
- `DATA_SERVICE_URL` — URL for data-service (default: `http://data-service:3001`)

**gateway:**
- `AUTH_SERVICE_URL` — URL for auth-service token verification
- `DATA_SERVICE_URL` — URL for data-service message persistence
- `REDIS_HOST` / `REDIS_PORT` — Redis connection

### Development Workflow

To run a service locally (outside Docker) for active development:

```bash
cd services/auth-service
npm install
npm run dev   # ts-node-dev with auto-restart on file changes
```

Same pattern applies to `data-service` and `gateway`. Make sure ScyllaDB and Redis are still running via Docker Compose.

### Service Communication Map

```
Browser
  │
  ├──HTTP──► auth-service (login/register)
  ├──HTTP──► data-service (guild/channel/message reads)
  └──WS───► gateway
               │
               ├──HTTP──► auth-service (token verify)
               ├──HTTP──► data-service (persist messages)
               └──Redis Pub/Sub──► (fan-out to all gateway instances)
```

> Note: The frontend currently calls each service directly. A unified API gateway (reverse proxy) is not yet implemented.

---

## Part 2: User Guide (End-to-End Experience)

### What is Jiscord?

Jiscord is a real-time text chat app, similar to Discord. You join servers (called **guilds**), browse **channels** within each guild, and send messages that appear instantly to everyone viewing the same channel.

### Step 1: Open the app

Navigate to `http://localhost:5173` in your browser. You will be redirected to the login page.

### Step 2: Create an account

Click **Register** (or navigate to `/register`).

Fill in:
- **Username** — Your display name
- **Email** — Used to log in (must be unique)
- **Password** — Minimum length enforced

Click **Register**. On success, you are redirected to the login page.

> If the email is already taken, you will see a `409 Conflict` error.

Alternatively, use the demo account created by the seed script: `demo@example.com` / `password123`.

### Step 3: Log in

Enter your email and password on the login page and click **Login**.

On success, a JWT token is issued and stored in memory (not in localStorage or cookies — it is cleared on page refresh). You are redirected to the main chat interface at `/channels`.

### Step 4: Browse or create guilds

The left sidebar displays the guilds you are a member of.

- **Select a guild** — click its icon
- **Create a guild** — click the **+** button at the bottom of the sidebar, enter a name, and press Create. You are automatically added as a member and taken to the new guild.
- **Browse & join guilds** — click the **search (🔍)** button to open the guild browser. Click **Join** next to any guild you want to join.

### Step 5: Browse or create channels

After selecting a guild, the channel list appears in the second panel.

- **Select a channel** — click its name
- **Create a channel** — click the **+** button next to the "Channels" header, type a name (spaces are converted to hyphens), and press **Add** or hit Enter.

### Step 6: Read message history

When you open a channel, recent messages are loaded automatically in newest-first order. Scroll up to load older messages — the UI supports cursor-based pagination backed by ScyllaDB's native page state.

Each message displays:
- The author's username
- The message content
- The timestamp (derived from the timeuuid message ID)

### Step 7: Send a message

Click the message input at the bottom of the channel view, type your message, and press **Enter** (or click Send).

What happens behind the scenes:
1. Your browser sends a `SEND_MESSAGE` event over the WebSocket connection to the gateway.
2. The gateway persists the message to ScyllaDB via data-service.
3. The gateway publishes the message to a Redis channel: `jiscord:channel:<channelId>`.
4. All gateway instances subscribed to that channel receive the event and push a `MESSAGE_CREATE` event to every WebSocket client viewing that channel.
5. The message appears instantly in all connected browsers — including yours.

### Step 8: Real-time updates

You do not need to refresh. Any message sent by another user in the same channel will appear in real time via the WebSocket connection. The gateway maintains a heartbeat (started after authentication is confirmed) to keep the connection alive.

### Session behavior

- Your session is tied to the JWT token held in memory.
- Refreshing the page clears the token and returns you to the login screen.
- Only one active session per user is supported at a time. Logging in on a second browser will invalidate the first session.

---

## What's Not Yet Available

The following features are not yet implemented in the current MVP:

- Editing or deleting messages
- Direct messages (DMs)
- File or image uploads
- Presence / online status indicators
- Member lists per guild
- An API gateway / reverse proxy (frontend calls each service directly)
