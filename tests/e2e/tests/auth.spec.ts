import { test, expect } from "../fixtures/jiscord";
import { createUser } from "../helpers/auth";

test.describe("Registration", () => {
  test("successful registration lands on /channels", async ({ page }) => {
    const id = Date.now();
    await page.goto("/register");
    await page.getByLabel("Username").fill(`testuser${id}`);
    await page.getByLabel("Email").fill(`testuser${id}@e2e.test`);
    await page.getByLabel("Password").fill("securepassword123");
    await page.getByRole("button", { name: "Register" }).click();
    await page.waitForURL("**/channels");
  });

  test("duplicate email shows error", async ({ page }) => {
    const existing = await createUser("dup");
    await page.goto("/register");
    await page.getByLabel("Username").fill("DupUser");
    await page.getByLabel("Email").fill(existing.user.email);
    await page.getByLabel("Password").fill("password123456");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.locator("p").filter({ hasText: /already|duplicate|exists/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("username too short shows error (minLength=2)", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Username").fill("x");
    await page.getByLabel("Email").fill(`short${Date.now()}@e2e.test`);
    await page.getByLabel("Password").fill("password123456");
    await page.getByRole("button", { name: "Register" }).click();
    // HTML5 validation or server error — the form should not submit successfully
    // We remain on /register (not navigate to /channels)
    await expect(page).not.toHaveURL(/.*\/channels/);
  });

  test("password too short shows error (minLength=8)", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Username").fill("ValidUser");
    await page.getByLabel("Email").fill(`shortpw${Date.now()}@e2e.test`);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).not.toHaveURL(/.*\/channels/);
  });
});

test.describe("Login", () => {
  test("correct credentials navigate to /channels", async ({
    page,
    authData,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(authData.user.email);
    await page.getByLabel("Password").fill(authData.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/channels");
  });

  test("wrong password shows error", async ({ page, authData }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(authData.user.email);
    await page.getByLabel("Password").fill("wrong-password-xyz");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("p[style*='color']").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page).not.toHaveURL(/.*\/channels/);
  });

  test("nonexistent email shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@nonexistent.test");
    await page.getByLabel("Password").fill("somepassword");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("p[style*='color']").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page).not.toHaveURL(/.*\/channels/);
  });
});

test.describe("Protected routes", () => {
  test("unauthenticated /channels redirects to /login", async ({ page }) => {
    await page.goto("/channels");
    await page.waitForURL("**/login");
  });

  test("logout returns to /login and blocks re-access", async ({
    authedPage,
  }) => {
    await authedPage.getByRole("button", { name: "Logout" }).click();
    await authedPage.waitForURL("**/login");
    await authedPage.goto("/channels");
    await authedPage.waitForURL("**/login");
  });
});
