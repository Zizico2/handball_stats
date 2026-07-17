import { expect, type Page } from "@playwright/test";

/**
 * Refresh Clerk session cookies via a browser navigation, then return
 * `page.request` for authenticated API seeding. Late Playwright projects
 * often 401 on the static storageState from setup alone.
 */
export async function refreshE2eSession(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Past Games" })).toBeVisible({
    timeout: 30_000,
  });
  return page.request;
}
