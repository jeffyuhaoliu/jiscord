import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import { createUser, CreatedUser } from "../helpers/auth";

interface JiscordFixtures {
  authData: CreatedUser;
  authedPage: Page;
  secondAuthData: CreatedUser;
  secondPage: Page;
}

export const test = base.extend<JiscordFixtures>({
  authData: async ({}, use) => {
    const userData = await createUser();
    await use(userData);
  },

  authedPage: async ({ page, authData }, use) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(authData.user.email);
    await page.getByLabel("Password").fill(authData.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/channels");
    await use(page);
  },

  secondAuthData: async ({}, use) => {
    const userData = await createUser("user2");
    await use(userData);
  },

  secondPage: async ({ browser, secondAuthData }, use) => {
    const context: BrowserContext = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(secondAuthData.user.email);
    await page.getByLabel("Password").fill(secondAuthData.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/channels");
    await use(page);
    await context.close();
  },
});

export { expect };
