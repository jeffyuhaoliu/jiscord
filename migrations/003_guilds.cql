-- Migration 003: Guilds, channels, and membership tables
-- Access patterns: AP-5, AP-6 (channels), AP-7 (user_guilds), AP-8, AP-10 (guild_members), AP-9 (guilds)

-- AP-9: Look up a single guild by ID
CREATE TABLE IF NOT EXISTS jiscord.guilds (
    guild_id   uuid      PRIMARY KEY,
    name       text,
    created_at timestamp
);

-- AP-5: List channels in a guild (ordered by creation time)
-- AP-6: Look up a single channel by ID (requires guild_id context)
CREATE TABLE IF NOT EXISTS jiscord.channels (
    guild_id   uuid,
    channel_id uuid,
    name       text,
    created_at timestamp,
    PRIMARY KEY (guild_id, channel_id)
) WITH CLUSTERING ORDER BY (channel_id ASC);

-- AP-8: List members of a guild
-- AP-10: Updated as part of join-guild LOGGED BATCH (with user_guilds)
CREATE TABLE IF NOT EXISTS jiscord.guild_members (
    guild_id uuid,
    user_id  uuid,
    joined_at timestamp,
    PRIMARY KEY (guild_id, user_id)
) WITH CLUSTERING ORDER BY (user_id ASC);

-- AP-7: List guilds a user belongs to (sidebar)
-- AP-10: Updated alongside guild_members in a LOGGED BATCH to keep both consistent
CREATE TABLE IF NOT EXISTS jiscord.user_guilds (
    user_id  uuid,
    guild_id uuid,
    PRIMARY KEY (user_id, guild_id)
) WITH CLUSTERING ORDER BY (guild_id ASC);
