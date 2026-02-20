-- Migration 002: Messages table
-- Access patterns: AP-1 (write message), AP-2 (read newest-first, paginated)

-- AP-1 / AP-2: Messages partitioned by channel; clustered newest-first by timeuuid.
-- Pagination cursor: last message_id seen → WHERE channel_id = ? AND message_id < ? LIMIT 50
CREATE TABLE IF NOT EXISTS jiscord.messages (
    channel_id uuid,
    message_id timeuuid,
    author_id  uuid,
    content    text,
    PRIMARY KEY (channel_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
