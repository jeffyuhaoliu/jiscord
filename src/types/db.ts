/**
 * TypeScript interfaces derived from CQL schemas.
 * Type mapping: uuid → string, timeuuid → string, timestamp → Date, text → string
 */

/** jiscord.users — primary lookup by user_id (AP-3) */
export interface User {
  user_id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

/** jiscord.users_by_email — lookup by email, returns user_id (AP-4) */
export interface UserByEmail {
  email: string;
  user_id: string;
}

/** jiscord.messages — partitioned by channel, clustered newest-first (AP-1, AP-2) */
export interface Message {
  channel_id: string;
  message_id: string;
  author_id: string;
  content: string;
}

/** jiscord.guilds — primary lookup by guild_id (AP-9) */
export interface Guild {
  guild_id: string;
  name: string;
  created_at: Date;
}

/** jiscord.channels — partitioned by guild, list/lookup channels (AP-5, AP-6) */
export interface Channel {
  guild_id: string;
  channel_id: string;
  name: string;
  created_at: Date;
}

/** jiscord.guild_members — list members of a guild (AP-8, AP-10) */
export interface GuildMember {
  guild_id: string;
  user_id: string;
  joined_at: Date;
}

/** jiscord.user_guilds — list guilds a user belongs to (AP-7, AP-10) */
export interface UserGuild {
  user_id: string;
  guild_id: string;
}
