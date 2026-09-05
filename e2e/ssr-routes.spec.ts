import { expect, test } from "./fixtures";

const authenticatedRoutes = [
  { path: "/", marker: 'data-testid="home-hub"' },
  { path: "/create-teams", marker: "E2E Home" },
  { path: "/new-game", marker: "New Game" },
  { path: "/active-game", marker: "No active game. Choose a home team first." },
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
});
