import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

async function startGameWithLineupAndFirstHalf(page: Page) {
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

  await page.getByText("#7 Alex").click();
  await page.getByText("#12 Blake").click();
  await expect(page.getByRole("button", { name: "Save Lineup" })).toBeEnabled({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "Save Lineup" }).click();

  await page.getByRole("button", { name: "Match controls" }).click();
  await page.getByRole("menuitem", { name: "Start First Half" }).click();

  const attack = page.getByRole("button", { name: "Attack" });
  await expect(attack).toBeEnabled({ timeout: 15_000 });
}

test.describe("match mutation sync states", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("keeps start-game failure visible with retry", async ({ page }) => {
    test.setTimeout(60_000);

    await page.route("**/api/collections/games/start", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "simulated start failure" }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/new-game");
    await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();

    const startGame = page.getByRole("button", { name: "Start Game" });
    await expect(startGame).toBeEnabled({ timeout: 15_000 });
    await startGame.click();

    await expect(page).toHaveURL(/\/new-game/);
    await expect(page.getByTestId("match-sync-failure")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("match-sync-status")).toHaveAttribute(
      "data-status",
      "failed",
    );
    await expect(startGame).toBeEnabled();
    await expect(
      page.getByTestId("match-sync-failure").getByRole("button", {
        name: "Retry",
      }),
    ).toBeVisible();
  });

  test("reconciles a committed game start when its response is lost", async ({
    page,
  }) => {
    let intercepted = false;
    await page.route("**/api/collections/games/start", async (route) => {
      if (route.request().method() === "POST" && !intercepted) {
        intercepted = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.goto("/new-game");
    const startGame = page.getByRole("button", { name: "Start Game" });
    await expect(startGame).toBeEnabled({ timeout: 15_000 });
    await startGame.click();

    await expect(page).toHaveURL(/\/active-game/);
    await expect(page.getByTestId("match-sync-failure")).toHaveCount(0);
  });

  test("keeps clock mutation failure visible with retry", async ({ page }) => {
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
    await page.getByText("#7 Alex").click();
    await page.getByText("#12 Blake").click();
    await page.getByRole("button", { name: "Save Lineup" }).click();
    await expect(
      page.getByRole("heading", { name: "Define Starting Lineup" }),
    ).toBeHidden({ timeout: 15_000 });

    await page.route(
      "**/api/collections/games/*/transitions",
      async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "simulated clock failure" }),
          });
          return;
        }
        await route.continue();
      },
    );

    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "Start First Half" }).click();

    await expect(page.getByTestId("match-sync-failure")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("match-sync-status")).toHaveAttribute(
      "data-status",
      "failed",
    );
    await expect(
      page.getByTestId("match-sync-failure").getByRole("button", {
        name: "Retry",
      }),
    ).toBeVisible();

    // Menu should not stay stuck pending after failure.
    await page.getByRole("button", { name: "Match controls" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Start First Half" }),
    ).toBeVisible();
  });

  test("keeps event save failure visible and does not treat it as saved", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await startGameWithLineupAndFirstHalf(page);

    await page.route("**/api/collections/player-events", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "simulated event failure" }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "Attack" }).click();
    await page.getByRole("button", { name: "Shot" }).click();
    await page.getByRole("button", { name: /#7/ }).click();
    await page.getByRole("button", { name: "9m+" }).click();
    await page.getByRole("button", { name: "Top left" }).click();
    await page.getByRole("button", { name: "Goal", exact: true }).click();

    await expect(page.getByTestId("match-sync-failure")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("match-sync-status")).toHaveAttribute(
      "data-status",
      "failed",
    );
    await expect(
      page.getByTestId("match-sync-failure").getByRole("button", {
        name: "Retry",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Match controls" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Start Halftime" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("menuitem", { name: "End Match" }),
    ).toBeDisabled();
    await expect(page.getByText(/Position: 9m\+/)).toHaveCount(0);
  });

  test("reconciles a committed event when its response is lost", async ({
    page,
  }) => {
    await startGameWithLineupAndFirstHalf(page);

    let intercepted = false;
    await page.route("**/api/collections/player-events", async (route) => {
      if (route.request().method() === "POST" && !intercepted) {
        intercepted = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "Attack" }).click();
    await page.getByRole("button", { name: "Shot" }).click();
    await page.getByRole("button", { name: /#7/ }).click();
    await page.getByRole("button", { name: "9m+" }).click();
    await page.getByRole("button", { name: "Top left" }).click();
    await page.getByRole("button", { name: "Goal", exact: true }).click();

    // Saved chip is delay-gated; fast reconcile may stay visually idle.
    await expect(page.getByText(/Position: 9m\+/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("match-sync-failure")).toHaveCount(0);
    await page.unrouteAll({ behavior: "wait" });
  });

  test("keeps end-match failure visible and retries it", async ({ page }) => {
    await startGameWithLineupAndFirstHalf(page);

    let shouldFail = true;
    await page.route("**/api/collections/active-game", async (route) => {
      if (route.request().method() === "DELETE" && shouldFail) {
        shouldFail = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "simulated end failure" }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "End Match" }).click();
    await expect(
      page.getByRole("heading", { name: "End this match?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "End match" }).click();
    const failure = page.getByTestId("match-sync-failure");
    await expect(failure).toBeVisible({ timeout: 15_000 });
    await failure.getByRole("button", { name: "Retry" }).click();

    await expect(
      page.getByText("No active game.", { exact: false }),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
