/**
 * TypeScript interfaces for the data-service repositories.
 * Mirrors the canonical types in src/types/db.ts at the project root.
 */

/** jiscord.users - primary lookup by user_id (AP-3) */
export interface User {
  user_id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

/** jiscord.users_by_email - lookup by email, returns user_id (AP-4) */
export interface UserByEmail {
  email: string;
  user_id: string;
}

/** jiscord.guilds - primary lookup by guild_id (AP-9) */
export interface Guild {
  guild_id: string;
  name: string;
  created_at: Date;
}

/** jiscord.channels - partitioned by guild, list/lookup channels (AP-5, AP-6) */
export interface Channel {
  guild_id: string;
  channel_id: string;
  name: string;
  created_at: Date;
}

/** jiscord.guild_members - list members of a guild (AP-8, AP-10) */
export interface GuildMember {
  guild_id: string;
  user_id: string;
  joined_at: Date;
}

/** jiscord.user_guilds - list guilds a user belongs to (AP-7) */
export interface UserGuild {
  user_id: string;
  guild_id: string;
}

/** API shape for a message: created_at is derived from the timeuuid message_id */
export interface MessageRow {
  message_id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string; // ISO string extracted from timeuuid
}

export interface MessagesPage {
  messages: MessageRow[];
  nextPageState: string | null;
}
