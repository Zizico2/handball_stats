import { readFile } from "node:fs/promises";
import {
  type APIRequestContext,
  type APIResponse,
  expect,
  test,
} from "@playwright/test";
import { testClientId } from "../src/testing/clientId";
import { refreshE2eSession } from "./e2eAuth";

const hasE2eCredentials = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.E2E_RESET_TOKEN,
);

const TEAM = { id: testClientId(501), name: "Lifecycle Home" } as const;
const PLAYERS = [
  { id: testClientId(511), teamId: TEAM.id, name: "Alex", number: 7 },
  { id: testClientId(512), teamId: TEAM.id, name: "Blake", number: 12 },
] as const;

async function expectOk(response: APIResponse) {
  if (!response.ok()) {
    throw new Error(
      `Request to ${response.url()} failed: ${response.status()} ${await response.text()}`,
    );
  }
}

async function resetUser(request: APIRequestContext) {
  const token = process.env.E2E_RESET_TOKEN;
  if (!token) {
    throw new Error("E2E_RESET_TOKEN is required for lifecycle cleanup");
  }

  const response = await request.post("/api/e2e/reset", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(204);
}

async function seedRoster(request: APIRequestContext) {
  await expectOk(
    await request.post("/api/collections/teams", { data: [TEAM] }),
  );
  await expectOk(
    await request.post("/api/collections/team-players", { data: PLAYERS }),
  );
}

async function openMatchControls(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Match controls" }).click();
}

test.describe("full match lifecycle", () => {
  test.skip(
    !hasE2eCredentials,
    "Requires Clerk and E2E reset credentials for isolated lifecycle data.",
  );

  test.beforeEach(async ({ page }) => {
    const request = await refreshE2eSession(page);
    await resetUser(request);
    await seedRoster(request);
  });

  test.afterEach(async ({ page }) => {
    const request = await refreshE2eSession(page);
    await resetUser(request);
  });

  test("completes a match and exports its event history", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/new-game");
    await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();

    const startGame = page.getByRole("button", { name: "Start Game" });
    await expect(startGame).toBeEnabled({ timeout: 15_000 });
    await startGame.click();

    await expect(page).toHaveURL(/\/active-game/);
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

    await openMatchControls(page);
    await page.getByRole("menuitem", { name: "Start First Half" }).click();
    const attack = page.getByRole("button", { name: "Attack" });
    await expect(attack).toBeEnabled({ timeout: 15_000 });

    await attack.click();
    await page.getByRole("button", { name: "Shot" }).click();
    await page.getByRole("button", { name: /#7/ }).click();
    await page.getByRole("button", { name: "9m+" }).click();
    await page.getByRole("button", { name: "Top left" }).click();
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await expect(page.getByText(/Direction: OnTarget/)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Defense" }).click();
    await page.getByRole("button", { name: "Shot", exact: true }).click();
    await page.getByRole("button", { name: "6m+" }).click();
    await page.getByRole("button", { name: "Top right" }).click();
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await expect(page.getByText(/Goal: Yes/)).toHaveCount(2, {
      timeout: 15_000,
    });
    await expect(attack).toBeEnabled({ timeout: 15_000 });

    await openMatchControls(page);
    await page.getByRole("menuitem", { name: "Pause Match" }).click();
    await openMatchControls(page);
    await expect(
      page.getByRole("menuitem", { name: "Resume Match" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("menuitem", { name: "Resume Match" }).click();
    await expect(attack).toBeEnabled({ timeout: 15_000 });

    await openMatchControls(page);
    await page.getByRole("menuitem", { name: "Start Halftime" }).click();
    await expect(
      page.getByRole("button", { name: "Set Starting Lineup" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Set Starting Lineup" }).click();
    await expect(page.getByRole("checkbox", { name: "#7 Alex" })).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "#12 Blake" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Save Lineup" }).click();
    await expect(
      page.getByRole("heading", { name: "Define Starting Lineup" }),
    ).toBeHidden({ timeout: 15_000 });

    await openMatchControls(page);
    await page.getByRole("menuitem", { name: "Start Second Half" }).click();
    await expect(attack).toBeEnabled({ timeout: 15_000 });

    await openMatchControls(page);
    await page.getByRole("menuitem", { name: "End Match" }).click();
    await expect(
      page.getByRole("heading", { name: "End this match?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "End match" }).click();

    await expect(page).toHaveURL(/\/past-games\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: TEAM.name })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("1–1 score", { exact: true })).toBeVisible();
    await expect(
      page.getByText("6 logged events", { exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Back to past games" }).click();
    await expect(
      page.getByRole("heading", { name: "Past Games", exact: true }),
    ).toBeVisible();
    const pastGame = page.getByRole("link", { name: new RegExp(TEAM.name) });
    await expect(
      pastGame.getByText("1–1 score", { exact: true }),
    ).toBeVisible();
    await expect(pastGame.getByText("6 events", { exact: true })).toBeVisible();

    await pastGame.click();
    await expect(page).toHaveURL(/\/past-games\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: TEAM.name })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export event log CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().trim()).not.toBe("");

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const csv = await readFile(downloadPath as string, "utf8");
    const shotRow = csv
      .split(/\r?\n/)
      .find((row) => row.split(",").includes("shot"));
    expect(shotRow).toBeDefined();
    expect(shotRow).toContain("OnTarget");
    expect(shotRow?.toLowerCase()).toContain("true");
  });
});
