import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { refreshE2eSession } from "./e2eAuth";
import { E2E_GAME_ID, E2E_TEAM_ID, seedE2eData } from "./seedE2eData";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

const PLAYERS = [
  { id: 1, teamId: E2E_TEAM_ID, name: "Alex", number: 7 },
  { id: 2, teamId: E2E_TEAM_ID, name: "Blake", number: 12 },
] as const;

const VIEWPORTS = [
  { name: "320px", width: 320, height: 720 },
  { name: "390px", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

async function deleteAllTeams(request: APIRequestContext) {
  // Preview DBs keep past games that FK-reference teams. Wipe dependents in
  // the same order as test/d1/db.ts before deleting teams.
  const activeGames = await request.get("/api/collections/active-game");
  expect(activeGames.ok()).toBeTruthy();
  const activeRows = (await activeGames.json()) as Array<{ id: number }>;
  if (activeRows.length > 0) {
    const deleted = await request.delete("/api/collections/active-game", {
      data: activeRows.map((row) => row.id),
    });
    expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
  }

  const pauseToggles = await request.get("/api/collections/pause-toggles");
  expect(pauseToggles.ok()).toBeTruthy();
  const pauseRows = (await pauseToggles.json()) as Array<{ id: string }>;
  for (const row of pauseRows) {
    const deleted = await request.delete(
      `/api/collections/pause-toggles/${row.id}`,
    );
    expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
  }

  const events = await request.get("/api/collections/player-events");
  expect(events.ok()).toBeTruthy();
  const eventRows = (await events.json()) as Array<{ id: number }>;
  if (eventRows.length > 0) {
    const deleted = await request.delete("/api/collections/player-events", {
      data: eventRows.map((row) => row.id),
    });
    expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
  }

  const games = await request.get("/api/collections/games");
  expect(games.ok()).toBeTruthy();
  const gameRows = (await games.json()) as Array<{ id: number }>;
  if (gameRows.length > 0) {
    const deleted = await request.delete("/api/collections/games", {
      data: gameRows.map((row) => row.id),
    });
    expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
  }

  const pairs = await request.get("/api/collections/quick-sub-pairs");
  expect(pairs.ok()).toBeTruthy();
  const pairRows = (await pairs.json()) as Array<{ id: number }>;
  if (pairRows.length > 0) {
    const deleted = await request.delete("/api/collections/quick-sub-pairs", {
      data: pairRows.map((row) => row.id),
    });
    expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
  }

  await deleteAllPlayers(request);

  const teams = await request.get("/api/collections/teams");
  expect(teams.ok()).toBeTruthy();
  const rows = (await teams.json()) as Array<{ id: number }>;
  if (rows.length === 0) {
    return;
  }
  const deleted = await request.delete("/api/collections/teams", {
    data: rows.map((row) => row.id),
  });
  expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
}

async function deleteAllPlayers(request: APIRequestContext) {
  const players = await request.get("/api/collections/team-players");
  expect(players.ok()).toBeTruthy();
  const rows = (await players.json()) as Array<{ id: number }>;
  if (rows.length === 0) {
    return;
  }
  const deleted = await request.delete("/api/collections/team-players", {
    data: rows.map((row) => row.id),
  });
  expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
}

async function startActiveGame(request: APIRequestContext, gameId: number) {
  const start = await request.post("/api/collections/games/start", {
    data: {
      id: gameId,
      homeTeamId: E2E_TEAM_ID,
      createdAt: new Date().toISOString(),
    },
  });
  expect(start.ok()).toBeTruthy();
}

async function assertContentGridAlignment(page: Page) {
  const clock = page.getByRole("heading", { name: "Match Clock" });
  const warning = page.getByTestId("starting-lineup-prompt");
  const attack = page.getByRole("button", { name: "Attack" });
  const defense = page.getByRole("button", { name: "Defense" });
  const sanction = page.getByRole("button", { name: "Sanction" });
  const substitution = page.getByRole("button", { name: "Substitution" });
  const matchLog = page.getByRole("heading", { name: "Match Log" });

  await expect(clock).toBeVisible();
  await expect(warning).toBeVisible();
  await expect(
    page.getByText(/Starting lineup is not defined yet/i),
  ).toBeVisible();
  await expect(attack).toBeVisible();
  await expect(matchLog).toBeVisible();

  const clockBox = await clock.boundingBox();
  const warningBox = await warning.boundingBox();
  const attackBox = await attack.boundingBox();
  const defenseBox = await defense.boundingBox();
  const sanctionBox = await sanction.boundingBox();
  const substitutionBox = await substitution.boundingBox();
  const logBox = await matchLog.boundingBox();

  expect(clockBox).not.toBeNull();
  expect(warningBox).not.toBeNull();
  expect(attackBox).not.toBeNull();
  expect(defenseBox).not.toBeNull();
  expect(sanctionBox).not.toBeNull();
  expect(substitutionBox).not.toBeNull();
  expect(logBox).not.toBeNull();
  if (
    clockBox == null ||
    warningBox == null ||
    attackBox == null ||
    defenseBox == null ||
    sanctionBox == null ||
    substitutionBox == null ||
    logBox == null
  ) {
    throw new Error("Expected Active Game layout bounding boxes");
  }

  // 16px minimum mobile gutters (also holds on desktop via content padding).
  expect(clockBox.x).toBeGreaterThanOrEqual(16);
  expect(warningBox.x).toBeGreaterThanOrEqual(16);
  expect(attackBox.x).toBeGreaterThanOrEqual(16);
  expect(logBox.x).toBeGreaterThanOrEqual(16);

  // Clock, warning, event controls, and log share the same content-grid left edge.
  const leftEdges = [clockBox.x, warningBox.x, attackBox.x, logBox.x];
  const contentLeft = Math.min(...leftEdges);
  for (const left of leftEdges) {
    expect(Math.abs(left - contentLeft)).toBeLessThanOrEqual(2);
  }

  // Event buttons keep ≥44×44 touch targets and do not collide.
  for (const box of [attackBox, defenseBox, sanctionBox, substitutionBox]) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(attackBox.x + attackBox.width).toBeLessThanOrEqual(defenseBox.x);
  expect(sanctionBox.x + sanctionBox.width).toBeLessThanOrEqual(
    substitutionBox.x,
  );
  expect(attackBox.y + attackBox.height).toBeLessThanOrEqual(sanctionBox.y);
  expect(defenseBox.y + defenseBox.height).toBeLessThanOrEqual(
    substitutionBox.y,
  );
}

test.describe("home hub and match UX polish", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test.beforeEach(async ({ page }) => {
    const request = await refreshE2eSession(page);
    await seedE2eData(request);
  });

  test("signed-in home shows start-game hub with recent game link", async ({
    page,
  }) => {
    await page.goto("/");

    const hub = page.getByTestId("home-hub");
    await expect(hub).toHaveAttribute("data-hub-kind", "start-game", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Start a game" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start a game" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /E2E Home \(game #/ }),
    ).toBeVisible();
  });

  test("signed-in home shows create-team hub when user has no teams", async ({
    page,
  }) => {
    await deleteAllTeams(page.request);

    await page.goto("/");

    const hub = page.getByTestId("home-hub");
    await expect(hub).toHaveAttribute("data-hub-kind", "create-team", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Create your first team" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create team" }),
    ).toBeVisible();
  });

  test("signed-in home shows add-players hub when roster is empty", async ({
    page,
  }) => {
    await deleteAllPlayers(page.request);

    await page.goto("/");

    const hub = page.getByTestId("home-hub");
    await expect(hub).toHaveAttribute("data-hub-kind", "add-players", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Add players to your team" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add players" }),
    ).toBeVisible();

    await page.request.post("/api/collections/team-players", {
      data: [...PLAYERS],
    });
  });

  test("signed-in home shows resume-match hub with phase and clock", async ({
    page,
  }) => {
    await startActiveGame(page.request, E2E_GAME_ID + 40);

    await page.goto("/");

    const hub = page.getByTestId("home-hub");
    await expect(hub).toHaveAttribute("data-hub-kind", "resume-match", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Resume your match" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resume match" }),
    ).toBeVisible();
    await expect(page.getByTestId("home-hub-match-status")).toBeVisible();
    await expect(page.getByText("Not started")).toBeVisible();
    await expect(page.getByText("Ready")).toBeVisible();
  });

  test("new game blocks empty roster and links to team setup", async ({
    page,
  }) => {
    await deleteAllPlayers(page.request);

    await page.goto("/new-game");

    await expect(page.getByText(/needs at least 1 player/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Add players" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Game" }),
    ).toBeDisabled();

    await page.request.post("/api/collections/team-players", {
      data: [...PLAYERS],
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`active game layout at ${viewport.name} keeps gutters and touch targets`, async ({
      page,
    }) => {
      await startActiveGame(page.request, E2E_GAME_ID + 50 + viewport.width);

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/active-game");

      await expect(page.getByText("Match Clock")).toBeVisible({
        timeout: 15_000,
      });
      await assertContentGridAlignment(page);
    });
  }

  test("end-match confirmation focuses Continue match", async ({ page }) => {
    await startActiveGame(page.request, E2E_GAME_ID + 90);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/active-game");

    await expect(page.getByText("Match Clock")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "End Match" }).click();
    await expect(
      page.getByRole("heading", { name: "End this match?" }),
    ).toBeVisible();

    const continueMatch = page.getByRole("button", { name: "Continue match" });
    await expect(continueMatch).toBeVisible();
    await expect(continueMatch).toBeFocused();

    await continueMatch.click();
    await expect(
      page.getByRole("heading", { name: "End this match?" }),
    ).toHaveCount(0);
  });
});
