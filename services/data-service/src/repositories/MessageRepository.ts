import { types } from 'cassandra-driver';
import { client } from '../db/client';
import { MessageRow, MessagesPage } from '../types/db';

export type { MessageRow, MessagesPage };

export class MessageRepository {
  async insertMessage(data: {
    channel_id: string;
    author_id: string;
    content: string;
  }): Promise<MessageRow> {
    const { channel_id, author_id, content } = data;
    const messageId = types.TimeUuid.now();
    const query =
      'INSERT INTO messages (channel_id, message_id, author_id, content) VALUES (?, ?, ?, ?)';
    await client.execute(query, [channel_id, messageId, author_id, content], { prepare: true });
    return {
      message_id: messageId.toString(),
      channel_id,
      author_id,
      content,
      created_at: messageId.getDate().toISOString(),
    };
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
