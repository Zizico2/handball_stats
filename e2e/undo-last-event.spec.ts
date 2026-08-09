import type { APIRequestContext, Page } from "@playwright/test";
import { teamPlayerSchema } from "../src/datamodel";
import { testClientId } from "../src/testing/clientId";
import { expect, test } from "./fixtures";
import { E2E_TEAM_ID } from "./seedE2eData";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

const BENCH_PLAYER = {
  id: testClientId(13),
  teamId: E2E_TEAM_ID,
  name: "Casey",
  number: 9,
} as const;

async function ensureBenchPlayer(request: APIRequestContext) {
  const response = await request.get("/api/collections/team-players");
  expect(response.ok()).toBeTruthy();
  const players = teamPlayerSchema.array().parse(await response.json());
  if (players.some((player) => player.id === BENCH_PLAYER.id)) {
    return;
  }

  const createResponse = await request.post("/api/collections/team-players", {
    data: [BENCH_PLAYER],
  });
  expect(createResponse.ok()).toBeTruthy();
}

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

async function confirmUndoLastEvent(page: Page, undoButtonName: RegExp) {
  const undoButton = page.getByRole("button", { name: undoButtonName });
  await expect(undoButton).toBeEnabled({ timeout: 15_000 });
  await undoButton.click();

  await expect(
    page.getByRole("heading", { name: "Undo last event?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo event" }).click();
}

test.describe("undo last event", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("undoes a goal shot from the match log", async ({ page }) => {
    test.setTimeout(60_000);

    await startGameWithLineupAndFirstHalf(page);

    await page.getByRole("button", { name: "Attack" }).click();
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
    await expect(page.getByText(/Aim: TopLeft/)).toBeVisible();

    await confirmUndoLastEvent(page, /Undo: #7 Alex — Shot \(Goal\)/);

    await expect(page.getByText(/Position: 9m\+/)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "Undo last event" }),
    ).toBeDisabled();
  });

  test("undoes a substitution and restores on-court players", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // Start with the 2-player roster so lineup targetCount stays 2, then add a
    // bench player afterward (roster size would otherwise force selecting everyone).
    await startGameWithLineupAndFirstHalf(page);
    await ensureBenchPlayer(page.request);
    await page.reload();
    await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled({
      timeout: 15_000,
    });

    await expect(page.getByText("On Court (2)")).toBeVisible();
    const onCourtChip = (label: string) =>
      page.locator('[data-slot="chip"]', { hasText: label });

    await expect(onCourtChip("#7 Alex")).toBeVisible();
    await expect(onCourtChip("#12 Blake")).toBeVisible();

    await page.getByRole("button", { name: "Substitution" }).click();
    await page.getByRole("button", { name: /Pick players manually/ }).click();

    await expect(
      page.getByRole("heading", { name: "Pick Player Leaving" }),
    ).toBeVisible();
    await page
      .getByLabel("Pick Player Leaving")
      .getByRole("button", { name: "#7 Alex" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Pick Player Entering" }),
    ).toBeVisible();
    await page
      .getByLabel("Pick Player Entering")
      .getByRole("button", { name: "#9 Casey" })
      .click();

    await expect(
      page.getByRole("button", { name: /Undo: #7 Alex → #9 Casey/ }),
    ).toBeEnabled({ timeout: 15_000 });

    await expect(onCourtChip("#9 Casey")).toBeVisible();
    await expect(onCourtChip("#7 Alex")).toHaveCount(0);
    await expect(onCourtChip("#12 Blake")).toBeVisible();

    await confirmUndoLastEvent(page, /Undo: #7 Alex → #9 Casey/);

    await expect(onCourtChip("#7 Alex")).toBeVisible({ timeout: 15_000 });
    await expect(onCourtChip("#9 Casey")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Undo last event" }),
    ).toBeDisabled();
  });
});
