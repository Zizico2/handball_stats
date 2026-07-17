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
          await page.goto("/");
          await expect(
            page.getByRole("link", { name: "Past Games" }),
          ).toBeVisible({ timeout: 30_000 });
        }
        return false;
      },
      { timeout: 45_000, intervals: [500, 1_000, 2_000] },
    )
    .toBe(true);

  return page.request;
}
