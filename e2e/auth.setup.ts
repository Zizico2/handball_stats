import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join("playwright", ".auth", "user.json");
const email = process.env.E2E_CLERK_EMAIL;
const password = process.env.E2E_CLERK_PASSWORD;

setup("authenticate", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  if (!email || !password) {
    fs.writeFileSync(
      authFile,
      JSON.stringify({ cookies: [], origins: [] }, null, 2),
    );
    setup.skip(
      true,
      "Set E2E_CLERK_EMAIL and E2E_CLERK_PASSWORD to run instant navigation tests.",
    );
    return;
  }

  await page.goto("/");

  const signInButton = page.getByRole("button", { name: "Sign in" });
  await expect(signInButton).toBeVisible({ timeout: 15_000 });
  await signInButton.click();

  const identifierField = page
    .getByLabel(/email address|email/i)
    .or(page.locator('input[name="identifier"]'));
  await expect(identifierField.first()).toBeVisible({ timeout: 15_000 });
  await identifierField.first().fill(email);

  const continueButton = page.getByRole("button", { name: /continue/i });
  await continueButton.click();

  const passwordField = page
    .getByLabel(/^password$/i)
    .or(page.locator('input[name="password"]'));
  await expect(passwordField.first()).toBeVisible({ timeout: 15_000 });
  await passwordField.first().fill(password);

  await page.getByRole("button", { name: /continue|sign in/i }).click();

  await expect(page.getByRole("link", { name: "Past Games" })).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: authFile });
});
