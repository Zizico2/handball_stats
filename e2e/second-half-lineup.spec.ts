import type { APIRequestContext, Page } from "@playwright/test";
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
  const players = (await response.json()) as Array<{ id: string }>;
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

async function openStartingLineupDialog(page: Page) {
  await page.getByRole("button", { name: "Set Starting Lineup" }).click();
  await expect(
    page.getByRole("heading", { name: "Define Starting Lineup" }),
  ).toBeVisible();
}

function lineupCheckbox(page: Page, label: string) {
  return page.getByRole("checkbox", { name: label });
}

test.describe("second-half starting lineup preselect", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("toggles selection from the full row and via keyboard", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await startGameWithLineupAndFirstHalf(page);
    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "Start Halftime" }).click();
    await openStartingLineupDialog(page);

    const alex = lineupCheckbox(page, "#7 Alex");
    await expect(alex).toBeChecked();

    // HeroUI exposes role=checkbox on the small control; the full-width hit
    // target is the label (Checkbox.Content). Click its trailing edge.
    const alexRow = page.locator("label").filter({ hasText: "#7 Alex" });
    const alexBox = await alexRow.boundingBox();
    expect(alexBox).not.toBeNull();
    if (alexBox == null) {
      throw new Error("Expected Alex row label bounding box");
    }
    expect(alexBox.width).toBeGreaterThan(100);
    await page.mouse.click(
      alexBox.x + alexBox.width - 8,
      alexBox.y + alexBox.height / 2,
    );
    await expect(alex).not.toBeChecked();

    await alex.focus();
    await page.keyboard.press("Space");
    await expect(alex).toBeChecked();
  });

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

    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "Start Halftime" }).click();
    await expect(
      page.getByRole("button", { name: "Set Starting Lineup" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Set Starting Lineup" }).click();
    await expect(
      page.getByRole("heading", { name: "Define Starting Lineup" }),
    ).toBeVisible();

    await expect(
      page.getByRole("checkbox", { name: "#9 Casey" }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "#12 Blake" }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "#7 Alex" }),
    ).not.toBeChecked();
  });
});
