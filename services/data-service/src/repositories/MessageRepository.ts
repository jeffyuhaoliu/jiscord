import { client } from "../db/client";

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
  async getMessages(
    channelId: string,
    pageSize: number,
    pageState: string | undefined,
  ): Promise<MessagesPage> {
    const query =
      "SELECT channel_id, message_id, author_id, content FROM messages WHERE channel_id = ?";
    const result = await client.execute(query, [channelId], {
      prepare: true,
      fetchSize: pageSize,
      pageState: pageState,
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
      ? Buffer.isBuffer(ps) ? ps.toString("base64") : String(ps)
      : null;

    return { messages, nextPageState };
  }
}
