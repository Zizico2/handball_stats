import fs from "node:fs";
import path from "node:path";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { seedE2eData } from "./seedE2eData";

const authFile = path.join("playwright", ".auth", "user.json");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
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

setup("seed e2e data", async ({ playwright }) => {
  const request = await playwright.request.newContext({
    baseURL,
    storageState: authFile,
  });

  try {
    await seedE2eData(request);
  } finally {
    await request.dispose();
  }
});
