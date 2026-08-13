import { expect, test } from "./fixtures";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

test.describe("two-minute suspension lifecycle", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("shows a warning chip, confirms a warned event, and ends the suspension", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/new-game");
    await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
    await page.getByRole("button", { name: "Start Game" }).click();

    await expect(
      page.getByRole("button", { name: "Set Starting Lineup" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Set Starting Lineup" }).click();
    await page.getByText("#7 Alex").click();
    await page.getByText("#12 Blake").click();
    await page.getByRole("button", { name: "Save Lineup" }).click();

    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "Start First Half" }).click();
    await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Sanction" }).click();
    await page
      .getByRole("button", { name: "2 Minute Suspension", exact: true })
      .click();
    await page.getByRole("button", { name: /#7 Alex/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Who Serves the 2 Minute Suspension?",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save suspension" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Who Serves the 2 Minute Suspension?",
      }),
    ).toBeHidden();

    await page.getByRole("button", { name: "Attack" }).click();
    await page.getByRole("button", { name: "Shot", exact: true }).click();
    const suspendedPlayer = page.getByRole("button", {
      name: /2 min.*#7 Alex/,
    });
    await expect(suspendedPlayer).toBeVisible({ timeout: 15_000 });
    await suspendedPlayer.click();
    await expect(
      page.getByRole("heading", { name: "Player has an active suspension" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue anyway" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue anyway" }).click();

    await page.getByRole("button", { name: "9m+" }).click();
    await page.getByRole("button", { name: "Top left" }).click();
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await expect(page.getByText(/Position: 9m\+/)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Sanction" }).click();
    await page.getByRole("button", { name: "End 2 Minute Suspension" }).click();
    await expect(
      page.getByRole("heading", { name: "End 2 Minute Suspension" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /#7 Alex.*served by #7 Alex/ })
      .click();

    await expect(page.getByText(/Two Minute Suspension Ended/)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Attack" }).click();
    await page.getByRole("button", { name: "Shot", exact: true }).click();
    const playerButton = page.getByRole("button", {
      name: "#7 Alex",
      exact: true,
    });
    await expect(playerButton).toBeVisible();
    await playerButton.click();
    await expect(
      page.getByRole("heading", { name: "Pick Shot Position" }),
    ).toBeVisible();
  });
});
