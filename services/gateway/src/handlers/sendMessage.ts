import axios from 'axios';
import { clients, addChannelSubscriber } from '../state';
import { SendMessageData, MessageCreateData } from '../protocol';
import { publishToChannel } from '../redis';

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL ?? 'http://localhost:3001';

export async function handleSendMessage(sessionId: string, data: SendMessageData): Promise<void> {
  const client = clients.get(sessionId);
  if (\!client || \!client.userId) {
    console.warn(`[sendMessage] Unauthenticated session ${sessionId} tried to send message`);
    return;
  }

  const { channelId, content } = data;

  // Auto-subscribe sender to channel
  if (\!client.subscribedChannels.has(channelId)) {
    client.subscribedChannels.add(channelId);
    addChannelSubscriber(channelId, sessionId);
  }

  try {
    // Persist via data-service
    const response = await axios.post(`${DATA_SERVICE_URL}/messages`, {
      channelId,
      authorId: client.userId,
      content,
    });

    const message: MessageCreateData = response.data;

    // Publish to Redis for fan-out
    await publishToChannel(channelId, {
      event: 'MESSAGE_CREATE',
      data: message,
    });
  } catch (err) {
    console.error('[sendMessage] Failed to persist or publish message:', err);
  }
}
