import { expect, test } from "@playwright/test";
import { refreshE2eSession } from "./e2eAuth";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

test.describe("human preview smoke", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("authenticated pages, D1 binding, and static assets are available", async ({
    page,
  }) => {
    const request = await refreshE2eSession(page);

    await expect(page.getByRole("link", { name: "Past Games" })).toBeVisible();

    const teams = await request.get("/api/collections/teams");
    expect(teams.status()).toBe(200);
    expect(Array.isArray(await teams.json())).toBe(true);

    const staticAssetPath = await page
      .locator('script[src^="/_next/static/"]')
      .first()
      .getAttribute("src");
    expect(staticAssetPath).toBeTruthy();
    const staticAsset = await request.get(staticAssetPath as string);
    expect(staticAsset.status()).toBe(200);

    await page.goto("/past-games");
    await expect(
      page.getByRole("heading", { name: "Past Games" }),
    ).toBeVisible();
  });
});
