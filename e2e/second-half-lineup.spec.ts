import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { E2E_TEAM_ID } from "./seedE2eData";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

const BENCH_PLAYER = {
  id: 3,
  teamId: E2E_TEAM_ID,
  name: "Casey",
  number: 9,
} as const;

async function ensureBenchPlayer(request: APIRequestContext) {
  const response = await request.get("/api/collections/team-players");
  expect(response.ok()).toBeTruthy();
  const players = (await response.json()) as Array<{ id: number }>;
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

async function substituteAlexForCasey(page: Page) {
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

  await expect(page.getByText("On Court (2)")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator('[data-slot="chip"]', { hasText: "#9 Casey" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="chip"]', { hasText: "#7 Alex" }),
  ).toHaveCount(0);
}

async function startHalftime(page: Page) {
  await page.getByRole("button", { name: "Match controls" }).click();
  await page.getByRole("menuitem", { name: "Start Halftime" }).click();
  await expect(
    page.getByRole("button", { name: "Set Starting Lineup" }),
  ).toBeVisible({ timeout: 15_000 });
}

async function openStartingLineupDialog(page: Page) {
  const setButton = page.getByRole("button", { name: "Set Starting Lineup" });
  if (await setButton.isVisible()) {
    await setButton.click();
  } else {
    await page.getByRole("button", { name: "Edit Starting Lineup" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Define Starting Lineup" }),
  ).toBeVisible();
}

function lineupCheckbox(page: Page, label: string) {
  return page.getByRole("checkbox", { name: label });
}

async function expectCheckboxState(
  page: Page,
  label: string,
  checked: boolean,
) {
  await expect(lineupCheckbox(page, label)).toHaveAttribute(
    "aria-checked",
    checked ? "true" : "false",
  );
}

async function getStartingPlayersByHalf(request: APIRequestContext) {
  const response = await request.get("/api/collections/player-events");
  expect(response.ok()).toBeTruthy();
  const events = (await response.json()) as Array<{
    eventType: string;
    half: string;
    player: number;
  }>;
  const firstHalf = events
    .filter(
      (event) =>
        event.eventType === "startingPlayer" && event.half === "firstHalf",
    )
    .map((event) => event.player)
    .sort((a, b) => a - b);
  const secondHalf = events
    .filter(
      (event) =>
        event.eventType === "startingPlayer" && event.half === "secondHalf",
    )
    .map((event) => event.player)
    .sort((a, b) => a - b);
  return { firstHalf, secondHalf };
}

test.describe("second-half starting lineup preselect", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("preselects end-of-first-half on-court players after a substitution", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await startGameWithLineupAndFirstHalf(page);
    await ensureBenchPlayer(page.request);
    await page.reload();
    await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled({
      timeout: 15_000,
    });

    await substituteAlexForCasey(page);
    await startHalftime(page);
    await openStartingLineupDialog(page);

    await expectCheckboxState(page, "#9 Casey", true);
    await expectCheckboxState(page, "#12 Blake", true);
    await expectCheckboxState(page, "#7 Alex", false);
    await expect(
      page.getByRole("button", { name: "Save Lineup" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "Save Lineup" }).click();
    await expect(
      page.getByRole("heading", { name: "Define Starting Lineup" }),
    ).toBeHidden({ timeout: 15_000 });

    const { firstHalf, secondHalf } = await getStartingPlayersByHalf(
      page.request,
    );
    expect(firstHalf).toEqual([7, 12]);
    expect(secondHalf).toEqual([9, 12]);
  });

  test("keeps a manually adjusted saved lineup on reopen", async ({ page }) => {
    test.setTimeout(90_000);

    await startGameWithLineupAndFirstHalf(page);
    await ensureBenchPlayer(page.request);
    await page.reload();
    await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled({
      timeout: 15_000,
    });

    await substituteAlexForCasey(page);
    await startHalftime(page);
    await openStartingLineupDialog(page);

    // Adjust away from the preselected end-of-half lineup.
    await lineupCheckbox(page, "#9 Casey").click();
    await lineupCheckbox(page, "#7 Alex").click();
    await expectCheckboxState(page, "#7 Alex", true);
    await expectCheckboxState(page, "#12 Blake", true);
    await expectCheckboxState(page, "#9 Casey", false);

    await page.getByRole("button", { name: "Save Lineup" }).click();
    await expect(
      page.getByRole("heading", { name: "Define Starting Lineup" }),
    ).toBeHidden({ timeout: 15_000 });

    await openStartingLineupDialog(page);
    await expectCheckboxState(page, "#7 Alex", true);
    await expectCheckboxState(page, "#12 Blake", true);
    await expectCheckboxState(page, "#9 Casey", false);

    await page.getByRole("button", { name: "Cancel" }).click();

    const { firstHalf, secondHalf } = await getStartingPlayersByHalf(
      page.request,
    );
    expect(firstHalf).toEqual([7, 12]);
    expect(secondHalf).toEqual([7, 12]);
  });

  test("explains incomplete selection when a rostered on-court player is removed", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await startGameWithLineupAndFirstHalf(page);
    await ensureBenchPlayer(page.request);
    await page.reload();
    await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled({
      timeout: 15_000,
    });

    await substituteAlexForCasey(page);
    await startHalftime(page);

    const deleteResponse = await page.request.delete(
      "/api/collections/team-players",
      { data: [BENCH_PLAYER.id] },
    );
    expect(deleteResponse.ok()).toBeTruthy();
    await page.reload();

    await openStartingLineupDialog(page);

    await expect(page.getByTestId("starting-lineup-roster-gap")).toBeVisible();
    await expect(page.getByText("#9 Casey")).toHaveCount(0);
    await expectCheckboxState(page, "#12 Blake", true);
    await expectCheckboxState(page, "#7 Alex", false);
    await expect(
      page.getByRole("button", { name: "Save Lineup" }),
    ).toBeDisabled();
  });

  test("toggles selection from the full row and via keyboard", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await startGameWithLineupAndFirstHalf(page);
    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "Start Halftime" }).click();
    await openStartingLineupDialog(page);

    const alex = lineupCheckbox(page, "#7 Alex");
    await expect(alex).toHaveAttribute("aria-checked", "true");

    // Click near the trailing edge of the row (outside the control box).
    const alexBox = await alex.boundingBox();
    expect(alexBox).not.toBeNull();
    if (alexBox == null) {
      throw new Error("Expected Alex checkbox bounding box");
    }
    await page.mouse.click(
      alexBox.x + alexBox.width - 8,
      alexBox.y + alexBox.height / 2,
    );
    await expect(alex).toHaveAttribute("aria-checked", "false");

    await alex.focus();
    await page.keyboard.press("Space");
    await expect(alex).toHaveAttribute("aria-checked", "true");
  });

  test("retries a failed second-half lineup save without duplicating events", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await startGameWithLineupAndFirstHalf(page);
    await ensureBenchPlayer(page.request);
    await page.reload();
    await expect(page.getByRole("button", { name: "Attack" })).toBeEnabled({
      timeout: 15_000,
    });

    await substituteAlexForCasey(page);
    await startHalftime(page);
    await openStartingLineupDialog(page);

    let shouldFail = true;
    await page.route("**/api/collections/player-events", async (route) => {
      if (route.request().method() === "POST" && shouldFail) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "simulated lineup failure" }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "Save Lineup" }).click();

    await expect(page.getByTestId("match-sync-failure")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("match-sync-status")).toHaveAttribute(
      "data-status",
      "failed",
    );

    shouldFail = false;
    await page
      .getByTestId("match-sync-failure")
      .getByRole("button", { name: "Retry" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Define Starting Lineup" }),
    ).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId("match-sync-failure")).toHaveCount(0);

    const { firstHalf, secondHalf } = await getStartingPlayersByHalf(
      page.request,
    );
    expect(firstHalf).toEqual([7, 12]);
    expect(secondHalf).toEqual([9, 12]);
  });
});
