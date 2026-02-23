import DataLoader from 'dataloader';
import { client } from '../db/client';
import { Channel } from '../types/db';

type ChannelKey = string; // composite: `${guild_id}:${channel_id}`

export class ChannelRepository {
  private channelLoader: DataLoader<ChannelKey, Channel | null>;

  constructor() {
    this.channelLoader = new DataLoader<ChannelKey, Channel | null>(
      async (keys: readonly ChannelKey[]) => {
        // Group channel_ids by guild_id for efficient range queries
        const byGuild = new Map<string, string[]>();
        for (const key of keys) {
          const sep = key.indexOf(':');
          const guildId = key.slice(0, sep);
          const channelId = key.slice(sep + 1);
          if (!byGuild.has(guildId)) byGuild.set(guildId, []);
          byGuild.get(guildId)!.push(channelId);
        }

        const channelMap = new Map<ChannelKey, Channel>();
        for (const [guildId, channelIds] of byGuild) {
          const query =
            'SELECT guild_id, channel_id, name, created_at FROM channels WHERE guild_id = ? AND channel_id IN ?';
          const result = await client.execute(query, [guildId, channelIds], { prepare: true });
          for (const row of result.rows) {
            const key: ChannelKey = `${row.guild_id}:${row.channel_id}`;
            channelMap.set(key, {
              guild_id: row.guild_id.toString(),
              channel_id: row.channel_id.toString(),
              name: row.name as string,
              created_at: row.created_at as Date,
            });
          }
        }

        return keys.map((k) => channelMap.get(k) ?? null);
      },
      { cache: false },
    );
  }

  async getChannelsByGuild(guildId: string): Promise<Channel[]> {
    const query =
      'SELECT guild_id, channel_id, name, created_at FROM channels WHERE guild_id = ?';
    const result = await client.execute(query, [guildId], { prepare: true });
    return result.rows.map((row) => ({
      guild_id: row.guild_id.toString(),
      channel_id: row.channel_id.toString(),
      name: row.name as string,
      created_at: row.created_at as Date,
    }));
  }

  async getChannelById(guildId: string, channelId: string): Promise<Channel | null> {
    return this.channelLoader.load(`${guildId}:${channelId}`);
  }

  async createChannel(guildId: string, channelId: string, name: string): Promise<Channel> {
    const created_at = new Date();
    const query =
      'INSERT INTO channels (guild_id, channel_id, name, created_at) VALUES (?, ?, ?, ?)';
    await client.execute(query, [guildId, channelId, name, created_at], { prepare: true });
    return { guild_id: guildId, channel_id: channelId, name, created_at };
  }
}
