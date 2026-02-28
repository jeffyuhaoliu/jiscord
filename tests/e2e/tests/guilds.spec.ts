import { test, expect } from "../fixtures/jiscord";
import { apiCreateGuild, apiJoinGuild } from "../helpers/api";

test.describe("Create guild", () => {
  test("create panel opens, submit name, guild icon appears in sidebar", async ({
    authedPage: page,
    authData,
  }) => {
    const guildName = `TestGuild-${Date.now()}`;

    // Open create panel via the "+" button (title="Create a server")
    await page.getByTitle("Create a server").click();
    await expect(page.getByText("Create Server")).toBeVisible();

    // Fill guild name and submit
    await page.getByPlaceholder("Server name").fill(guildName);
    await page.getByRole("button", { name: "Create" }).click();

    // Guild icon (first 2 chars uppercased) should appear in sidebar
    const abbrev = guildName.slice(0, 2).toUpperCase();
    await expect(
      page.getByRole("button", { name: abbrev })
    ).toBeVisible({ timeout: 10_000 });

    // Panel should close
    await expect(page.getByText("Create Server")).not.toBeVisible();
  });
});

test.describe("Browse guilds", () => {
  test("browse panel lists other users' guilds with join/joined state", async ({
    authedPage: page,
    authData,
    secondAuthData,
  }) => {
    // Seed a guild from secondAuthData that authData hasn't joined
    const seededGuild = await apiCreateGuild(
      secondAuthData.user.user_id,
      `BrowseGuild-${Date.now()}`
    );

    // Also seed a guild that authData has already joined
    const ownGuild = await apiCreateGuild(
      authData.user.user_id,
      `OwnGuild-${Date.now()}`
    );

    // Open browse panel
    await page.getByTitle("Browse servers").click();
    await expect(page.getByText("Browse Servers")).toBeVisible();

    // Seeded guild from second user should appear
    await expect(
      page.getByText(seededGuild.name)
    ).toBeVisible({ timeout: 5000 });

    // Own guild should show "Joined" badge
    await expect(page.getByText(ownGuild.name)).toBeVisible();
    // The own guild row should have a "Joined" badge
    const ownRow = page.locator("li").filter({ hasText: ownGuild.name });
    await expect(ownRow.getByText("Joined")).toBeVisible();
  });
});

test.describe("Join guild", () => {
  test("clicking Join adds guild to sidebar", async ({
    authedPage: page,
    authData,
    secondAuthData,
  }) => {
    // Create a guild owned by secondAuthData
    const targetGuild = await apiCreateGuild(
      secondAuthData.user.user_id,
      `JoinMe-${Date.now()}`
    );

    // Open browse panel
    await page.getByTitle("Browse servers").click();
    await expect(page.getByText("Browse Servers")).toBeVisible();
    await expect(page.getByText(targetGuild.name)).toBeVisible({ timeout: 5000 });

    // Click Join
    const guildRow = page.locator("li").filter({ hasText: targetGuild.name });
    await guildRow.getByRole("button", { name: "Join" }).click();

    // Guild icon should appear in sidebar
    const abbrev = targetGuild.name.slice(0, 2).toUpperCase();
    await expect(
      page.getByRole("button", { name: abbrev })
    ).toBeVisible({ timeout: 10_000 });
  });
});
