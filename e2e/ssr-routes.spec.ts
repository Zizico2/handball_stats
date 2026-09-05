import { testClientId } from "../src/testing/clientId";
import { expect, test } from "./fixtures";
import { E2E_GAME_ID } from "./seedE2eData";

const authenticatedRoutes = [
  { path: "/", marker: 'data-testid="home-hub"' },
  { path: "/create-teams", marker: "E2E Home" },
  { path: "/new-game", marker: "New Game" },
  { path: "/active-game", marker: "No active game. Choose a home team first." },
  { path: "/past-games", marker: "E2E Home" },
  { path: `/past-games/${E2E_GAME_ID}`, marker: "Match Log" },
] as const;

test.describe("authenticated route SSR", () => {
  for (const { path, marker } of authenticatedRoutes) {
    test(`${path} renders route content in the initial HTML`, async ({
      page,
    }) => {
      const response = await page.request.get(path, {
        headers: { Accept: "text/html" },
      });

      expect(response.ok()).toBe(true);
      expect(await response.text()).toContain(marker);
    });
  }

  test("renders the not-found boundary for invalid and missing past-game IDs", async ({
    page,
  }) => {
    const invalid = await page.request.get("/past-games/not-a-uuid", {
      headers: { Accept: "text/html" },
    });
    expect(invalid.ok()).toBe(true);
    expect(await invalid.text()).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/i);

    const missing = await page.request.get(`/past-games/${testClientId(999)}`, {
      headers: { Accept: "text/html" },
    });
    expect(missing.ok()).toBe(true);
    expect(await missing.text()).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/i);
  });
});
