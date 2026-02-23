// WebSocket opcodes - Discord-like gateway protocol
export enum OpCode {
  HELLO = 'HELLO',
  IDENTIFY = 'IDENTIFY',
  HEARTBEAT = 'HEARTBEAT',
  HEARTBEAT_ACK = 'HEARTBEAT_ACK',
  READY = 'READY',
  SEND_MESSAGE = 'SEND_MESSAGE',
  MESSAGE_CREATE = 'MESSAGE_CREATE',
  TYPING_START = 'TYPING_START',
  TYPING = 'TYPING',
  INVALID_SESSION = 'INVALID_SESSION',
}

export interface GatewayPayload<T = unknown> {
  op: OpCode;
  d: T;
}

export interface HelloData {
  heartbeat_interval: number;
}

export interface IdentifyData {
  userId: string;
  token: string;
}

export interface ReadyData {
  userId: string;
  sessionId: string;
}

export interface SendMessageData {
  channelId: string;
  content: string;
}

export interface MessageCreateData {
  messageId: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface TypingStartData {
  channelId: string;
}

export interface TypingData {
  channelId: string;
  userId: string;
  timestamp: number;
}
