import { instant } from "@next/playwright";
import { expect, test } from "./fixtures";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

test.describe("instant navigations", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("drawer shell and past games header appear instantly", async ({
    page,
  }) => {
    await page.goto("/");

    await instant(page, async () => {
      await page.getByRole("link", { name: "Past Games" }).click();
      await expect(
        page.getByRole("heading", { name: "Past Games" }),
      ).toBeVisible();
      await expect(
        page.getByText("Open any finished game to inspect its event log."),
      ).toBeVisible();
    });

    await expect(
      page.getByText(/No past games yet|goals|events/).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test("active game route shows content-shaped loading shell", async ({
    page,
  }) => {
    await page.goto("/");

    await instant(page, async () => {
      await page.getByRole("link", { name: "Active Game" }).click();
      await expect(
        page.getByRole("heading", { name: "Arcazzi" }),
      ).toBeVisible();
    });

    await expect(
      page.getByText(/New Game|Active game|Select/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("past game detail shows back link instantly", async ({ page }) => {
    await page.goto("/past-games");

    const gameLink = page.locator('a[href^="/past-games/"]').first();
    const gameLinkCount = await gameLink.count();

    test.skip(
      gameLinkCount === 0,
      "No past games available for detail nav test.",
    );

    await instant(page, async () => {
      await gameLink.click();
      await expect(
        page.getByRole("link", { name: /Back to past games/i }),
      ).toBeVisible();
    });

    await expect(
      page.getByText(/logged events|rostered players|goals/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
