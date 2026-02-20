# ScyllaDB Access Patterns (Query-First Design)

This document defines every query the application must support **before any schema is written**.
All table designs in `migrations/` must trace back to an access pattern listed here.

---

## Access Patterns

### AP-1: Write a message to a channel

| Field             | Value                                 |
|-------------------|---------------------------------------|
| **Type**          | Write                                 |
| **Description**   | Insert a new message into a channel   |
| **Partition key** | `channel_id (uuid)`                   |
| **Clustering key**| `message_id (timeuuid) DESC`          |
| **Cardinality**   | High — many messages per channel      |
| **Table**         | `messages_by_channel`                 |
| **Notes**         | TimeUUID encodes wall-clock time; DESC order means newest rows are at the head of the partition, enabling efficient newest-first reads without a secondary sort. |

---

### AP-2: Read messages by channel, newest-first, paginated

| Field             | Value                                          |
|-------------------|------------------------------------------------|
| **Type**          | Read                                           |
| **Description**   | Fetch up to N messages from a channel, newest first; support cursor-based pagination |
| **Partition key** | `channel_id (uuid)`                            |
| **Clustering key**| `message_id (timeuuid) DESC`                   |
| **Cardinality**   | High reads; page size ~50                      |
| **Table**         | `messages_by_channel`                          |
| **Notes**         | AP-2 drives the `messages_by_channel` table design. Pagination cursor is the last `message_id` (timeuuid) seen. CQL: `SELECT … WHERE channel_id = ? AND message_id < ? LIMIT 50`. |

---

### AP-3: Look up a single user by ID

| Field             | Value                                  |
|-------------------|----------------------------------------|
| **Type**          | Read                                   |
| **Description**   | Fetch user profile by primary key      |
| **Partition key** | `user_id (uuid)`                       |
| **Clustering key**| —                                      |
| **Cardinality**   | Low per request; high total user count |
| **Table**         | `users`                                |
| **Notes**         | Single-partition read; no clustering key needed. |

---

### AP-4: Look up a user by email

| Field             | Value                                           |
|-------------------|-------------------------------------------------|
| **Type**          | Read                                            |
| **Description**   | Resolve a user's `user_id` from their email (login flow) |
| **Partition key** | `email (text)`                                  |
| **Clustering key**| —                                               |
| **Cardinality**   | Low per request; globally unique emails         |
| **Table**         | `users_by_email`                                |
| **Notes**         | Dedicated lookup table to avoid a full scan of `users`. Stores only `user_id`; caller then issues AP-3 to get full profile. |

---

### AP-5: List channels in a guild

| Field             | Value                                             |
|-------------------|---------------------------------------------------|
| **Type**          | Read                                              |
| **Description**   | Fetch all channels belonging to a guild, ordered by creation time |
| **Partition key** | `guild_id (uuid)`                                 |
| **Clustering key**| `channel_id (uuid) ASC`                           |
| **Cardinality**   | Low per guild (~10s of channels)                  |
| **Table**         | `channels`                                        |
| **Notes**         | All channels for a guild are in one partition; small partition, full-partition reads are acceptable. |

---

### AP-6: Look up a single channel by ID

| Field             | Value                                   |
|-------------------|-----------------------------------------|
| **Type**          | Read                                    |
| **Description**   | Fetch channel metadata (name, guild) by channel ID |
| **Partition key** | `guild_id (uuid)`                       |
| **Clustering key**| `channel_id (uuid)`                     |
| **Cardinality**   | Low                                     |
| **Table**         | `channels`                              |
| **Notes**         | Requires knowing `guild_id`; callers that have only `channel_id` must carry `guild_id` context or use a secondary `channels_by_id` table if needed in future. |

---

### AP-7: List guilds a user belongs to

| Field             | Value                                                  |
|-------------------|--------------------------------------------------------|
| **Type**          | Read                                                   |
| **Description**   | Fetch all guild IDs for a given user (sidebar guild list) |
| **Partition key** | `user_id (uuid)`                                       |
| **Clustering key**| `guild_id (uuid) ASC`                                  |
| **Cardinality**   | Low per user (~10s of guilds)                          |
| **Table**         | `user_guilds`                                          |
| **Notes**         | Reverse-lookup table maintained alongside guild membership writes. |

---

### AP-8: List members of a guild

| Field             | Value                                              |
|-------------------|----------------------------------------------------|
| **Type**          | Read                                               |
| **Description**   | Fetch all user IDs that belong to a guild          |
| **Partition key** | `guild_id (uuid)`                                  |
| **Clustering key**| `user_id (uuid) ASC`                               |
| **Cardinality**   | Medium — up to 1 000s of members per guild for MVP |
| **Table**         | `guild_members`                                    |
| **Notes**         | One partition per guild; acceptable for MVP scale. |

---

### AP-9: Look up a single guild by ID

| Field             | Value                            |
|-------------------|----------------------------------|
| **Type**          | Read                             |
| **Description**   | Fetch guild metadata (name, created_at) by primary key |
| **Partition key** | `guild_id (uuid)`                |
| **Clustering key**| —                                |
| **Cardinality**   | Low                              |
| **Table**         | `guilds`                         |
| **Notes**         | Single-partition read; canonical home for guild metadata referenced by `channels` and `guild_members`. |

---

### AP-10: Write guild membership (join guild)

| Field             | Value                                                          |
|-------------------|----------------------------------------------------------------|
| **Type**          | Write (two mutations in a batch)                               |
| **Description**   | Add a user to a guild; must update both `guild_members` and `user_guilds` atomically |
| **Partition key** | `guild_id` (in `guild_members`) / `user_id` (in `user_guilds`) |
| **Clustering key**| `user_id` / `guild_id`                                         |
| **Cardinality**   | Low frequency                                                  |
| **Tables**        | `guild_members` + `user_guilds`                                |
| **Notes**         | Use a `LOGGED BATCH` to keep both tables consistent. Failure to write both leaves membership in an inconsistent state. |

---

## Table → Access Pattern Mapping

| Table              | Driven by                |
|--------------------|--------------------------|
| `messages_by_channel` | AP-1, AP-2            |
| `users`            | AP-3                     |
| `users_by_email`   | AP-4                     |
| `channels`         | AP-5, AP-6               |
| `user_guilds`      | AP-7, AP-10              |
| `guild_members`    | AP-8, AP-10              |
| `guilds`           | AP-9                     |

---

## Deferred Patterns (post-MVP)

| Pattern | Description | Reason deferred |
|---------|-------------|-----------------|
| AP-D1 | Full-text message search | Requires Elasticsearch or ScyllaDB Enterprise search index |
| AP-D2 | Read receipts / message reactions | Additional write amplification; not in MVP scope |
| AP-D3 | Direct messages between users | Separate `dm_messages` table; deferred per PRD Non-Goals |
