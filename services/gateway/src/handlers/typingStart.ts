import { clients, addChannelSubscriber } from '../state';
import { TypingStartData, TypingData } from '../protocol';
import { publishToChannel } from '../redis';

export async function handleTypingStart(sessionId: string, data: TypingStartData): Promise<void> {
  const client = clients.get(sessionId);
  if (!client || !client.userId) {
    console.warn(`[typingStart] Unauthenticated session ${sessionId}`);
    return;
  }

  const { channelId } = data;

  // Auto-subscribe if needed
  if (!client.subscribedChannels.has(channelId)) {
    client.subscribedChannels.add(channelId);
    addChannelSubscriber(channelId, sessionId);
  }

  const typingData: TypingData = {
    channelId,
    userId: client.userId,
    timestamp: Date.now(),
  };

  await publishToChannel(channelId, {
    event: 'TYPING',
    data: typingData,
  });
}
