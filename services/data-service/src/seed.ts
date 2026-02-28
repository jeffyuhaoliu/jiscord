/**
 * Dev seed script — populates a fresh Jiscord instance with:
 *   - A demo user (demo@example.com / password123)
 *   - A "General" guild
 *   - A "general" channel inside that guild
 *
 * Run with: npm run seed
 * Requires auth-service (3003) and data-service (3001) to be running.
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:3003";
const DATA_URL = process.env.DATA_SERVICE_URL ?? "http://localhost:3001";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";
const DEMO_USERNAME = "demo";

async function post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === "object" && data !== null && "error" in data
      ? (data as { error: string }).error
      : text;
    throw new Error(`POST ${url} → ${res.status}: ${msg}`);
  }
  return data as T;
}

async function get<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${String(data)}`);
  return data as T;
}

async function main() {
  console.log("Jiscord seed script starting...\n");

  // 1. Register demo user (ignore 409 if already exists)
  console.log(`[1/4] Registering demo user (${DEMO_EMAIL})...`);
  try {
    await post(`${AUTH_URL}/register`, { username: DEMO_USERNAME, email: DEMO_EMAIL, password: DEMO_PASSWORD });
    console.log("      ✓ Registered");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("409")) {
      console.log("      ✓ Already exists — skipping");
    } else {
      throw err;
    }
  }

  // 2. Login to get user_id
  console.log("[2/4] Logging in...");
  const loginRes = await post<{ token: string; user: { user_id: string } }>(
    `${AUTH_URL}/login`,
    { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  );
  const { user_id } = loginRes.user;
  console.log(`      ✓ Logged in as user_id=${user_id}`);

  // 3. Create guild (or detect if demo user already has one)
  console.log("[3/4] Creating 'General' guild...");
  const existingGuilds = await get<Array<{ guild_id: string; name: string }>>(
    `${DATA_URL}/guilds/me`,
    { "X-User-ID": user_id },
  );
  let guildId: string;
  const existingGeneral = existingGuilds.find((g) => g.name === "General");
  if (existingGeneral) {
    guildId = existingGeneral.guild_id;
    console.log(`      ✓ Already exists (guild_id=${guildId}) — skipping`);
  } else {
    const guild = await post<{ guild_id: string; name: string }>(
      `${DATA_URL}/guilds`,
      { name: "General", creator_user_id: user_id },
    );
    guildId = guild.guild_id;
    console.log(`      ✓ Created guild_id=${guildId}`);
  }

  // 4. Create channel
  console.log("[4/4] Creating 'general' channel...");
  const existingChannels = await get<Array<{ channel_id: string; name: string }>>(
    `${DATA_URL}/guilds/${guildId}/channels`,
  );
  if (existingChannels.some((c) => c.name === "general")) {
    console.log("      ✓ Already exists — skipping");
  } else {
    const channel = await post<{ channel_id: string; name: string }>(
      `${DATA_URL}/guilds/${guildId}/channels`,
      { name: "general" },
    );
    console.log(`      ✓ Created channel_id=${channel.channel_id}`);
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((err: unknown) => {
  console.error("\n❌ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
