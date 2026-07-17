import { expect, test } from "@playwright/test";
import { refreshE2eSession } from "./e2eAuth";
import { seedE2eData } from "./seedE2eData";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

test.describe("active game empty state", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test.beforeEach(async ({ page }) => {
    const request = await refreshE2eSession(page);
    await seedE2eData(request);
  });

  test("shows empty state when user has teams but no active game", async ({
    page,
  }) => {
    await page.goto("/active-game");

    await expect(
      page.getByText("No active game. Choose a home team first."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: "Go to New Game" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set Starting Lineup" }),
    ).toHaveCount(0);
  });
});
