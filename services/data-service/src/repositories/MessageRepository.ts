import { client } from '../db/client';

export interface MessageRow {
  message_id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface MessagesPage {
  messages: MessageRow[];
  nextPageState: string | null;
}

export class MessageRepository {
  async insertMessage(data: {
    channel_id: string;
    author_id: string;
    content: string;
  }): Promise<void> {
    const { channel_id, author_id, content } = data;
    // now() generates a server-side timeuuid for message_id
    const query =
      'INSERT INTO messages (channel_id, message_id, author_id, content) VALUES (?, now(), ?, ?)';
    await client.execute(query, [channel_id, author_id, content], { prepare: true });
  }

  async getByChannel(params: {
    channel_id: string;
    pageState?: string;
    limit?: number;
  }): Promise<MessagesPage> {
    const { channel_id, pageState, limit = 50 } = params;
    const fetchSize = Math.min(limit, 100);
    const query =
      'SELECT channel_id, message_id, author_id, content FROM messages WHERE channel_id = ?';
    const result = await client.execute(query, [channel_id], {
      prepare: true,
      fetchSize,
      pageState,
    });

    const messages: MessageRow[] = result.rows.map((row) => {
      const msgId = row.message_id as { toString: () => string; getDate?: () => Date };
      const createdAt: Date = msgId.getDate ? msgId.getDate() : new Date();
      return {
        message_id: msgId.toString(),
        channel_id: (row.channel_id as { toString: () => string }).toString(),
        author_id: (row.author_id as { toString: () => string }).toString(),
        content: row.content as string,
        created_at: createdAt.toISOString(),
      };
    });

    const ps = result.pageState;
    const nextPageState = ps
      ? Buffer.isBuffer(ps) ? ps.toString('base64') : String(ps)
      : null;

    return { messages, nextPageState };
  }
}
