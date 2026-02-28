import { test, expect } from "../fixtures/jiscord";
import { apiCreateGuild, apiCreateChannel } from "../helpers/api";

test.describe("Create channel", () => {
  test("clicking + creates channel and shows it with # prefix", async ({
    authedPage: page,
    authData,
  }) => {
    // Seed a guild
    const guild = await apiCreateGuild(authData.user.user_id, `Guild-${Date.now()}`);
    const channelName = `general-${Date.now()}`;

    // Reload so the guild appears in sidebar
    await page.reload();

    // Click the guild in the sidebar
    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();

    // Click the "+" button to create a channel (title="Create channel")
    await page.getByTitle("Create channel").click();

    // Type channel name and press Enter
    await page.getByPlaceholder("channel-name").fill(channelName);
    await page.getByPlaceholder("channel-name").press("Enter");

    // Channel appears in the list with # prefix
    await expect(
      page.getByRole("button", { name: `# ${channelName}` })
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("List channels", () => {
  test("selecting a guild fetches and displays its channels", async ({
    authedPage: page,
    authData,
  }) => {
    // Seed guild + channel via API
    const guild = await apiCreateGuild(authData.user.user_id, `ListGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `list-chan-${Date.now()}`);

    // Reload so guild appears in sidebar
    await page.reload();

    // Select guild
    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();

    // Channel should appear
    await expect(
      page.getByRole("button", { name: `# ${channel.name}` })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("active channel is highlighted", async ({
    authedPage: page,
    authData,
  }) => {
    const guild = await apiCreateGuild(authData.user.user_id, `HLGuild-${Date.now()}`);
    const channel = await apiCreateChannel(guild.guild_id, `hl-chan-${Date.now()}`);

    await page.reload();

    const abbrev = guild.name.slice(0, 2).toUpperCase();
    await page.getByRole("button", { name: abbrev }).click();

    const channelBtn = page.getByRole("button", { name: `# ${channel.name}` });
    await channelBtn.click();

    // Active channel button should have the highlighted background style
    // The active style sets background: #42464d
    await expect(channelBtn).toHaveCSS("background-color", "rgb(66, 70, 77)");
  });
});
