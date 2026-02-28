import { test, expect } from "../fixtures/jiscord";
import { apiCreateGuild, apiCreateChannel, apiJoinGuild } from "../helpers/api";
import { GatewayClient } from "../helpers/gateway-client";

test.describe("Two-client MESSAGE_CREATE delivery", () => {
  test("User A sends via browser, User B (GatewayClient) receives MESSAGE_CREATE", async ({
    authedPage: page,
    authData,
    secondAuthData,
  }) => {
    // Setup: shared guild + channel
    const guild = await apiCreateGuild(authData.user.user_id, `RTGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `rt-chan-${Date.now()}`);
    await apiJoinGuild(guild.guild_id, secondAuthData.user.user_id);

    // Connect User B via GatewayClient
    const clientB = new GatewayClient(secondAuthData.token);
    await clientB.connect();

    // User B must subscribe by sending a probe SEND_MESSAGE to the channel
    clientB.send("SEND_MESSAGE", { channelId: channel.channel_id, content: "__probe__" });

    // Small delay to let subscription take effect
    await new Promise((r) => setTimeout(r, 500));

    // Set up listener BEFORE User A sends
    const messagePromise = clientB.waitFor("MESSAGE_CREATE", 15_000);

    // User A navigates to guild/channel in browser
    await page.reload();
    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    const sentText = `realtime-${Date.now()}`;
    const textarea = page.getByPlaceholder("Message #channel");
    await textarea.fill(sentText);
    await textarea.press("Enter");

    // User B should receive MESSAGE_CREATE
    const event = (await messagePromise) as {
      channelId: string;
      content: string;
    };
    expect(event.channelId).toBe(channel.channel_id);
    expect(event.content).toBe(sentText);

    clientB.close();
  });
});

test.describe("Single-session enforcement", () => {
  test("second IDENTIFY for same user evicts first session with INVALID_SESSION", async ({
    authData,
  }) => {
    // First connection
    const client1 = new GatewayClient(authData.token);
    await client1.connect();

    // Second connection with same token
    const client2 = new GatewayClient(authData.token);

    // Client1 should receive INVALID_SESSION
    const invalidPromise = client1.waitFor("INVALID_SESSION", 15_000);

    // Connect client2 (this triggers eviction of client1)
    await client2.connect();

    await invalidPromise; // Resolves = INVALID_SESSION received

    client1.close();
    client2.close();
  });
});

test.describe("Typing indicators", () => {
  test("User A types → typing indicator visible to User B via secondPage", async ({
    authedPage: pageA,
    authData,
    secondPage: pageB,
    secondAuthData,
  }) => {
    // Setup: shared guild + channel
    const guild = await apiCreateGuild(authData.user.user_id, `TypingGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `typing-chan-${Date.now()}`);
    await apiJoinGuild(guild.guild_id, secondAuthData.user.user_id);

    // User A navigates to channel
    await pageA.reload();
    const abbrevA = guild.name.slice(0, 2).toUpperCase();
    await pageA.getByRole("button", { name: abbrevA }).click();
    await pageA.getByRole("button", { name: `# ${channel.name}` }).click();

    // User B navigates to same channel
    await pageB.reload();
    await pageB.getByRole("button", { name: abbrevA }).click();
    await pageB.getByRole("button", { name: `# ${channel.name}` }).click();

    // User B first sends a message to subscribe (needed for TYPING events too)
    const textareaB = pageB.getByPlaceholder("Message #channel");
    await textareaB.fill("__subscribe__");
    await textareaB.press("Enter");
    await new Promise((r) => setTimeout(r, 500));

    // User A types in textarea (triggers TYPING_START after first keystroke)
    const textareaA = pageA.getByPlaceholder("Message #channel");
    await textareaA.fill("I am typing...");

    // User B should see typing indicator
    // The indicator shows "{userId} is typing…"
    await expect(pageB.locator("[style*='typing']").first()).toContainText(
      "typing",
      { timeout: 10_000 }
    );
  });
});
