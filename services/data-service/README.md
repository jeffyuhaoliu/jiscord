# data-service

Fastify service (port **3001**) that owns all ScyllaDB reads/writes for Jiscord. All multi-entity lookups are coalesced through DataLoader to prevent N+1 queries.

## API Surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | DB liveness check. Returns `503` if no ScyllaDB hosts are connected. |
| GET | `/channels/:channelId/messages` | — | Paginated message history. Query params: `limit` (default 50, max 100), `pageState` (opaque cursor). |
| POST | `/channels/:channelId/messages` | — | Insert a message. Body: `{ author_id, content }`. Returns `201 { ok: true }`. |
| GET | `/guilds/me` | `X-User-ID` header | List guilds the user belongs to. |
| GET | `/guilds/:guildId/channels` | — | List channels in a guild. |

### `/health` response

```json
{ "status": "ok", "db": "connected" }
// or
{ "status": "unavailable", "db": "disconnected" }  // HTTP 503
```

### GET `/channels/:channelId/messages` response

```json
{
  "messages": [
    { "message_id": "...", "channel_id": "...", "author_id": "...", "content": "...", "created_at": "2026-02-24T..." }
  ],
  "nextPageState": "<base64 cursor or null>"
}
```

Pass `nextPageState` back as `?pageState=<value>` to fetch the next page.

---

## DataLoader Flow

DataLoaders batch concurrent `load()` calls within the same event-loop tick into a single `IN ?` query. `cache: false` is set on all loaders — they are module-level singletons so disabling the cache avoids cross-request staleness.

```mermaid
sequenceDiagram
    participant Client
    participant Fastify
    participant Loader as DataLoader (batch fn)
    participant ScyllaDB

    Note over Client,ScyllaDB: GET /guilds/me (X-User-ID: u1)

    Client->>Fastify: GET /guilds/me
    Fastify->>ScyllaDB: SELECT guild_id FROM user_guilds WHERE user_id = u1
    ScyllaDB-->>Fastify: [g1, g2, g3]
    Fastify->>Loader: loadMany([g1, g2, g3])
    Note over Loader: Batches all keys into one query
    Loader->>ScyllaDB: SELECT guild_id, name, created_at FROM guilds WHERE guild_id IN [g1,g2,g3]
    ScyllaDB-->>Loader: [Guild(g1), Guild(g2), Guild(g3)]
    Loader-->>Fastify: [Guild, Guild, Guild]
    Fastify-->>Client: 200 [{guild_id, name, created_at}, ...]
```

```mermaid
sequenceDiagram
    participant Client
    participant Fastify
    participant UserLoader as UserDataLoader
    participant ScyllaDB

    Note over Client,ScyllaDB: getUserByEmail flow

    Client->>Fastify: (auth lookup)
    Fastify->>ScyllaDB: SELECT user_id FROM users_by_email WHERE email = ?
    ScyllaDB-->>Fastify: user_id
    Fastify->>UserLoader: load(user_id)
    UserLoader->>ScyllaDB: SELECT * FROM users WHERE user_id IN [user_id]
    ScyllaDB-->>UserLoader: User row
    UserLoader-->>Fastify: User
```

```mermaid
sequenceDiagram
    participant Client
    participant Fastify
    participant MsgRepo as MessageRepository
    participant ScyllaDB

    Note over Client,ScyllaDB: Cursor-based message pagination

    Client->>Fastify: GET /channels/c1/messages?limit=50
    Fastify->>MsgRepo: getByChannel({channel_id: c1, limit: 50})
    MsgRepo->>ScyllaDB: SELECT ... FROM messages WHERE channel_id = c1 [fetchSize=50]
    ScyllaDB-->>MsgRepo: rows + pageState
    MsgRepo-->>Fastify: {messages: [...], nextPageState: "..."}
    Fastify-->>Client: 200 {messages, nextPageState}

    Client->>Fastify: GET /channels/c1/messages?pageState=<cursor>
    Fastify->>MsgRepo: getByChannel({channel_id: c1, pageState: cursor})
    MsgRepo->>ScyllaDB: SELECT ... FROM messages WHERE channel_id = c1 [pageState=cursor]
    ScyllaDB-->>MsgRepo: next page rows + pageState
```

---

## Repository Summary

| Repository | DataLoader | Notes |
|------------|-----------|-------|
| `UserRepository` | `userLoader` (key: `user_id`) | `getUserByEmail` → `users_by_email` lookup then `load()` |
| `GuildRepository` | `guildLoader` (key: `guild_id`) | `getGuildsForUser` → `user_guilds` scan then `loadMany()` |
| `ChannelRepository` | `channelLoader` (key: `guild_id:channel_id`) | Groups by guild for efficient `IN` queries per partition |
| `MessageRepository` | — | Cursor pagination via ScyllaDB `pageState` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCYLLA_CONTACT_POINTS` | `localhost` | Comma-separated ScyllaDB contact points |
| `SCYLLA_LOCAL_DC` | `datacenter1` | Local data centre name |
| `SCYLLA_KEYSPACE` | `jiscord` | Keyspace to connect to |
