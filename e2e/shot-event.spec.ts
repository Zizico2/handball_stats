import { expect, test } from "@playwright/test";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

test.describe("shot event creation", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test.beforeEach(async ({ request }) => {
    const response = await request.get("/api/collections/active-game");
    expect(response.ok()).toBeTruthy();
    const activeGames = (await response.json()) as Array<{ id: number }>;
    if (activeGames.length === 0) {
      return;
    }

    const deleteResponse = await request.delete(
      "/api/collections/active-game",
      {
        data: activeGames.map((game) => game.id),
      },
    );
    expect(deleteResponse.status()).toBe(204);
  });

  test("records shot position through the live event dialogs", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/new-game");

    await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();

    const startGame = page.getByRole("button", { name: "Start Game" });
    await expect(startGame).toBeEnabled({ timeout: 15_000 });
    await startGame.click();

    await expect(page).toHaveURL(/\/active-game/);
    await expect(
      page.getByRole("button", { name: "Set Starting Lineup" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Set Starting Lineup" }).click();
    await expect(
      page.getByRole("heading", { name: "Define Starting Lineup" }),
    ).toBeVisible();

    // HeroUI checkbox control intercepts pointer events on the native input.
    await page.getByText("#7 Alex").click();
    await page.getByText("#12 Blake").click();
    await page.getByRole("button", { name: "Save Lineup" }).click();

    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "Start First Half" }).click();

    const attack = page.getByRole("button", { name: "Attack" });
    await expect(attack).toBeEnabled({ timeout: 15_000 });
    await attack.click();

    await page.getByRole("button", { name: "Shot" }).click();
    await page.getByRole("button", { name: /#7/ }).click();
    await expect(
      page.getByRole("heading", { name: "Pick Shot Position" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "9m+" }).click();

    await expect(
      page.getByRole("heading", { name: "Shot target" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Top left" }).click();

    await expect(
      page.getByRole("heading", { name: "Was it a Goal?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Goal", exact: true }).click();

    await expect(page.getByText(/Position: 9m\+/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Direction: OnTarget/)).toBeVisible();
    await expect(page.getByText(/Aim: TopLeft/)).toBeVisible();
  });
});
