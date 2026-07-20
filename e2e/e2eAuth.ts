import { clerk } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";

const testEmail = process.env.E2E_CLERK_EMAIL ?? "e2e+clerk_test@example.com";

async function signInAndWait(page: Page, force = false) {
  await page.goto("/");
  const pastGames = page.getByRole("link", { name: "Past Games" });

  if (force) {
    await clerk.signOut({ page });
    await clerk.signIn({ page, emailAddress: testEmail });
  } else if (!(await pastGames.isVisible())) {
    await clerk.signIn({ page, emailAddress: testEmail });
  }

  await expect(pastGames).toBeVisible({ timeout: 30_000 });
}

/**
 * Refresh Clerk session cookies via a browser navigation, then return
 * `page.request` for authenticated API seeding. Late Playwright projects
 * often 401 on the static storageState from setup alone.
 */
export async function refreshE2eSession(page: Page) {
  await signInAndWait(page);

  // UI auth can appear valid while API cookies are still catching up (or
  // briefly expired). Confirm a real authenticated request before seeding.
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/collections/teams");
        if (response.ok()) {
          return true;
        }
        if (response.status() === 401) {
          await signInAndWait(page, true);
        }
        return false;
      },
      { timeout: 45_000, intervals: [500, 1_000, 2_000] },
    )
    .toBe(true);

  return page.request;
}
