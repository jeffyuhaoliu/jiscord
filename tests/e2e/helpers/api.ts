// Direct API helpers — call services by port (bypass Vite proxy).
// AUTH_BASE: auth-service on port 3003
// DATA_BASE: data-service on port 3001

const AUTH_BASE = "http://localhost:3003";
const DATA_BASE = "http://localhost:3001";

export interface UserData {
  user_id: string;
  username: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  user: UserData;
}

export interface Guild {
  guild_id: string;
  name: string;
}

export interface Channel {
  channel_id: string;
  guild_id: string;
  name: string;
}

export interface Message {
  message_id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export async function apiRegister(
  username: string,
  email: string,
  password: string
): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Register failed: ${res.status}`);
  }
}

export async function apiLogin(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Login failed: ${res.status}`);
  }
  return res.json() as Promise<LoginResponse>;
}

export async function apiCreateGuild(
  userId: string,
  name: string
): Promise<Guild> {
  const res = await fetch(`${DATA_BASE}/guilds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, creator_user_id: userId }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Create guild failed: ${res.status}`);
  }
  return res.json() as Promise<Guild>;
}

export async function apiCreateChannel(
  guildId: string,
  name: string
): Promise<Channel> {
  const res = await fetch(`${DATA_BASE}/guilds/${guildId}/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Create channel failed: ${res.status}`);
  }
  return res.json() as Promise<Channel>;
}

export async function apiJoinGuild(
  guildId: string,
  userId: string
): Promise<void> {
  const res = await fetch(`${DATA_BASE}/guilds/${guildId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Join guild failed: ${res.status}`);
  }
}

export async function apiPostMessage(
  channelId: string,
  authorId: string,
  content: string
): Promise<Message> {
  const res = await fetch(`${DATA_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author_id: authorId, content }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Post message failed: ${res.status}`);
  }
  return res.json() as Promise<Message>;
}

export async function apiGetMessages(
  channelId: string,
  params: { limit?: number; pageState?: string } = {}
): Promise<{ messages: Message[]; nextPageState: string | null }> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.pageState) qs.set("pageState", params.pageState);
  const res = await fetch(
    `${DATA_BASE}/channels/${channelId}/messages?${qs.toString()}`
  );
  if (!res.ok) {
    throw new Error(`Get messages failed: ${res.status}`);
  }
  return res.json() as Promise<{ messages: Message[]; nextPageState: string | null }>;
}
