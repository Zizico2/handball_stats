import fs from "node:fs";
import path from "node:path";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";

const authFile = path.join("playwright", ".auth", "user.json");
const testEmail = process.env.E2E_CLERK_EMAIL ?? "e2e+clerk_test@example.com";

setup.describe.configure({ mode: "serial" });

setup("clerk testing token", async () => {
  await clerkSetup();
});

setup("authenticate", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: testEmail });

  await expect(page.getByRole("link", { name: "Past Games" })).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: authFile });
});
