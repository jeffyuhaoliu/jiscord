export interface Message {
  message_id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface MessagesResponse {
  messages: Message[];
  nextPageState: string | null;
}
