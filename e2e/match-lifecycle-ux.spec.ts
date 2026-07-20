import { expect, test } from "@playwright/test";
import { E2E_GAME_ID, E2E_TEAM_ID, seedE2eData } from "./seedE2eData";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

const PLAYERS = [
  { id: 1, teamId: E2E_TEAM_ID, name: "Alex", number: 7 },
  { id: 2, teamId: E2E_TEAM_ID, name: "Blake", number: 12 },
] as const;

test.describe("home hub and match UX polish", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test.beforeEach(async ({ request }) => {
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

  test("new game blocks empty roster and links to team setup", async ({
    page,
    request,
  }) => {
    const players = await request.get("/api/collections/team-players");
    expect(players.ok()).toBeTruthy();
    const playerRows = (await players.json()) as Array<{ id: number }>;
    if (playerRows.length > 0) {
      const deleted = await request.delete("/api/collections/team-players", {
        data: playerRows.map((row) => row.id),
      });
      expect(deleted.ok() || deleted.status() === 204).toBeTruthy();
    }

    await page.goto("/new-game");

    await expect(page.getByText(/needs at least 1 player/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Add players" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Game" }),
    ).toBeDisabled();

    await request.post("/api/collections/team-players", {
      data: [...PLAYERS],
    });
  });

  test("active game has padded content and end-match confirmation", async ({
    page,
    request,
  }) => {
    const start = await request.post("/api/collections/games/start", {
      data: {
        id: E2E_GAME_ID + 50,
        homeTeamId: E2E_TEAM_ID,
        createdAt: new Date().toISOString(),
      },
    });
    expect(start.ok()).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/active-game");

    await expect(page.getByText("Match Clock")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Not started")).toBeVisible();
    await expect(page.getByText("Ready")).toBeVisible();

    const clock = page.getByText("Match Clock");
    const box = await clock.boundingBox();
    expect(box).not.toBeNull();
    if (box == null) {
      throw new Error("Expected Match Clock bounding box");
    }
    expect(box.x).toBeGreaterThanOrEqual(16);

    await page.getByRole("button", { name: "Match controls" }).click();
    await page.getByRole("menuitem", { name: "End Match" }).click();
    await expect(
      page.getByRole("heading", { name: "End this match?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue match" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue match" }).click();
    await expect(
      page.getByRole("heading", { name: "End this match?" }),
    ).toHaveCount(0);
  });
});
