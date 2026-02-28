import { test, expect } from "../fixtures/jiscord";
import { apiCreateGuild, apiCreateChannel, apiPostMessage, apiGetMessages } from "../helpers/api";

test.describe("Send message via UI", () => {
  test("Enter sends message and clears textarea", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `MsgGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `msg-chan-${Date.now()}`);

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    const message = `Hello world ${Date.now()}`;
    const textarea = page.getByPlaceholder("Message #channel");
    await textarea.fill(message);
    await textarea.press("Enter");

    // Message appears in the list
    await expect(page.getByText(message)).toBeVisible({ timeout: 10_000 });

    // Textarea is cleared
    await expect(textarea).toHaveValue("");
  });

  test("Shift+Enter inserts newline without sending", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `ShiftGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `shift-chan-${Date.now()}`);

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    const textarea = page.getByPlaceholder("Message #channel");
    await textarea.fill("line one");
    await textarea.press("Shift+Enter");
    await textarea.type("line two");

    // Textarea should still have content (not cleared/sent)
    const value = await textarea.inputValue();
    expect(value).toContain("line one");
    expect(value).toContain("line two");
  });
});

test.describe("Message display", () => {
  test("author and timestamp are visible", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `DispGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `disp-chan-${Date.now()}`);

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    const msg = `Display test ${Date.now()}`;
    const textarea = page.getByPlaceholder("Message #channel");
    await textarea.fill(msg);
    await textarea.press("Enter");

    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // Author (userId) is shown styled with font-weight: 700
    const authorEl = page.locator("span[style*='font-weight: 700']").first();
    await expect(authorEl).toBeVisible();

    // Timestamp — locateTimeString pattern present on page
    const timestampEl = page.locator("span[style*='font-size: 0.75rem']").first();
    await expect(timestampEl).toBeVisible();
  });

  test("empty channel shows placeholder text", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `EmptyGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `empty-chan-${Date.now()}`);

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    await expect(page.getByText("No messages yet")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Messaging API", () => {
  test("POST /channels/:id/messages returns full message row", async ({
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `APIGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `api-chan-${Date.now()}`);

    const msg = await apiPostMessage(channel.channel_id, authData.user.user_id, "API test message");

    expect(msg.message_id).toBeTruthy();
    expect(msg.channel_id).toBe(channel.channel_id);
    expect(msg.author_id).toBe(authData.user.user_id);
    expect(msg.content).toBe("API test message");
    expect(msg.created_at).toBeTruthy();
  });

  test("GET /channels/:id/messages returns messages newest-first", async ({
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `OrderGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `order-chan-${Date.now()}`);

    // Post 3 messages
    await apiPostMessage(channel.channel_id, authData.user.user_id, "first");
    await new Promise((r) => setTimeout(r, 100));
    await apiPostMessage(channel.channel_id, authData.user.user_id, "second");
    await new Promise((r) => setTimeout(r, 100));
    await apiPostMessage(channel.channel_id, authData.user.user_id, "third");

    const { messages } = await apiGetMessages(channel.channel_id, { limit: 10 });

    expect(messages.length).toBeGreaterThanOrEqual(3);
    // Newest first: "third" should appear before "first" in the raw response
    const contents = messages.map((m) => m.content);
    expect(contents.indexOf("third")).toBeLessThan(contents.indexOf("first"));
  });
});
