-- Migration 001: Users tables
-- Access patterns: AP-3 (lookup by user_id), AP-4 (lookup by email)

CREATE KEYSPACE IF NOT EXISTS jiscord
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

-- AP-3: Look up a single user by ID
CREATE TABLE IF NOT EXISTS jiscord.users (
    user_id       uuid        PRIMARY KEY,
    username      text,
    email         text,
    password_hash text,
    created_at    timestamp
);

-- AP-4: Look up a user by email (login flow)
-- Stores only user_id; caller issues a second read against jiscord.users for the full profile.
CREATE TABLE IF NOT EXISTS jiscord.users_by_email (
    email   text PRIMARY KEY,
    user_id uuid
);
