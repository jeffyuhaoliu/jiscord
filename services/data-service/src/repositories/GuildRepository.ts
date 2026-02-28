import DataLoader from 'dataloader';
import { client } from '../db/client';
import { Guild, GuildMember } from '../types/db';

export class GuildRepository {
  private guildLoader: DataLoader<string, Guild | null>;

  constructor() {
    this.guildLoader = new DataLoader<string, Guild | null>(
      async (guildIds: readonly string[]) => {
        const query = 'SELECT guild_id, name, created_at FROM guilds WHERE guild_id IN ?';
        const result = await client.execute(query, [[...guildIds]], { prepare: true });

        const byId = new Map<string, Guild>();
        for (const row of result.rows) {
          byId.set(row.guild_id.toString(), {
            guild_id: row.guild_id.toString(),
            name: row.name as string,
            created_at: row.created_at as Date,
          });
        }
        return guildIds.map((id) => byId.get(id) ?? null);
      },
      { cache: false },
    );
  }

  async getGuildById(guildId: string): Promise<Guild | null> {
    return this.guildLoader.load(guildId);
  }

  async createGuild(guildId: string, name: string): Promise<Guild> {
    const created_at = new Date();
    const query = 'INSERT INTO guilds (guild_id, name, created_at) VALUES (?, ?, ?)';
    await client.execute(query, [guildId, name, created_at], { prepare: true });
    return { guild_id: guildId, name, created_at };
  }

  async getGuildsForUser(userId: string): Promise<Guild[]> {
    const query = 'SELECT guild_id FROM user_guilds WHERE user_id = ?';
    const result = await client.execute(query, [userId], { prepare: true });
    const guildIds = result.rows.map((row) => row.guild_id.toString());
    if (guildIds.length === 0) return [];
    const guilds = await this.guildLoader.loadMany(guildIds);
    return guilds.filter((g): g is Guild => g !== null && !(g instanceof Error));
  }

  async getAll(): Promise<Guild[]> {
    const query = 'SELECT guild_id, name, created_at FROM guilds';
    const result = await client.execute(query, [], { prepare: true });
    return result.rows.map((row) => ({
      guild_id: row.guild_id.toString(),
      name: row.name as string,
      created_at: row.created_at as Date,
    }));
  }

  async joinGuild(guildId: string, userId: string): Promise<GuildMember> {
    const joined_at = new Date();
    // Use a LOGGED BATCH to keep guild_members and user_guilds consistent
    const batch = [
      {
        query: 'INSERT INTO guild_members (guild_id, user_id, joined_at) VALUES (?, ?, ?)',
        params: [guildId, userId, joined_at],
      },
      {
        query: 'INSERT INTO user_guilds (user_id, guild_id) VALUES (?, ?)',
        params: [userId, guildId],
      },
    ];
    await client.batch(batch, { prepare: true, logged: true });
    return { guild_id: guildId, user_id: userId, joined_at };
  }
}
