import { expect, test } from "./fixtures";

const hasE2eCredentials = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.E2E_RESET_TOKEN,
);

test.describe("shot event creation", () => {
  test.skip(
    !hasE2eCredentials,
    "Requires Clerk and E2E reset credentials for isolated event data.",
  );

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
    await expect(page.getByRole("button", { name: "Save Lineup" })).toBeEnabled(
      { timeout: 5_000 },
    );
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

    const defense = page.getByRole("button", { name: "Defense" });
    await defense.click();
    await page.getByRole("button", { name: "Shot", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Pick Shot Position" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pick a Player" }),
    ).toBeHidden();
    await page.getByRole("button", { name: "6m+" }).click();
    await page.getByRole("button", { name: "Bottom right" }).click();
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await expect(page.getByText(/DEFENSE/)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(
        "Goal: Yes | Position: 6m+ | Direction: OnTarget | Aim: BottomRight",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(defense).toBeEnabled({ timeout: 15_000 });

    await defense.click();
    await page
      .getByRole("button", { name: "Offensive Foul Provoked", exact: true })
      .click();
    await page.getByRole("button", { name: /#7/ }).click();
    await expect(page.getByText(/Offensive Foul Provoked/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Attack" }).click();
    await page
      .getByRole("button", { name: "Offensive Foul", exact: true })
      .click();
    await page.getByRole("button", { name: /#7/ }).click();
    await expect(
      page.getByText("#7 — Offensive Foul", { exact: true }),
    ).toBeVisible();
  });
});
