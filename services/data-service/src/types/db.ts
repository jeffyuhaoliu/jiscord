/**
 * TypeScript interfaces for the data-service repositories.
 * Mirrors the canonical types in src/types/db.ts at the project root.
 */

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

/** jiscord.user_guilds - list guilds a user belongs to (AP-7) */
export interface UserGuild {
  user_id: string;
  guild_id: string;
}
