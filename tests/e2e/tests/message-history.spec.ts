import { test, expect } from "../fixtures/jiscord";
import { apiCreateGuild, apiCreateChannel, apiPostMessage, apiGetMessages } from "../helpers/api";

test.describe("Load history", () => {
  test("empty channel shows placeholder", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `HistGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `hist-empty-${Date.now()}`);

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    await expect(page.getByText("No messages yet")).toBeVisible({ timeout: 5000 });
  });

  test("up to 50 messages loaded on channel open", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `HistFiftyGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `hist-fifty-${Date.now()}`);

    // Seed exactly 10 messages
    for (let i = 0; i < 10; i++) {
      await apiPostMessage(channel.channel_id, authData.user.user_id, `Message ${i}`);
    }

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    // All 10 messages should be visible (no Load More needed)
    await expect(page.getByText("Message 0")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Message 9")).toBeVisible();
    await expect(page.getByRole("button", { name: /load more/i })).not.toBeVisible();
  });
});

test.describe("Cursor pagination", () => {
  test("55 messages: 50 shown + Load More loads remaining 5", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `PagGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `pag-chan-${Date.now()}`);

    // Seed 55 messages sequentially
    for (let i = 0; i < 55; i++) {
      await apiPostMessage(channel.channel_id, authData.user.user_id, `Paginated ${i}`);
    }

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();
    await page.getByRole("button", { name: `# ${channel.name}` }).click();

    // Wait for messages to load
    await expect(page.getByText(/Paginated/)).toBeVisible({ timeout: 15_000 });

    // Load More button should be visible (there are more than 50)
    const loadMoreBtn = page.getByRole("button", { name: /load more/i });
    await expect(loadMoreBtn).toBeVisible({ timeout: 10_000 });

    // Intercept the paginated API call to verify pageState param is used
    let paginatedRequestSeen = false;
    page.on("request", (req) => {
      if (req.url().includes("/messages") && req.url().includes("pageState")) {
        paginatedRequestSeen = true;
      }
    });

    // Click Load More
    await loadMoreBtn.click();

    // After loading, all 55 messages are present → Load More disappears
    await expect(loadMoreBtn).not.toBeVisible({ timeout: 15_000 });

    // pageState was sent as a query param
    expect(paginatedRequestSeen).toBe(true);
  });
});

test.describe("API: message pagination", () => {
  test("GET /channels/:id/messages uses cursor pagination", async ({
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `CursorGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `cursor-chan-${Date.now()}`);

    // Seed 55 messages
    for (let i = 0; i < 55; i++) {
      await apiPostMessage(channel.channel_id, authData.user.user_id, `Cursor msg ${i}`);
    }

    // First page
    const page1 = await apiGetMessages(channel.channel_id, { limit: 50 });
    expect(page1.messages.length).toBe(50);
    expect(page1.nextPageState).not.toBeNull();

    // Second page using cursor
    const page2 = await apiGetMessages(channel.channel_id, {
      limit: 50,
      pageState: page1.nextPageState!,
    });
    expect(page2.messages.length).toBe(5);
    // No more pages
    expect(page2.nextPageState).toBeNull();
  });
});
