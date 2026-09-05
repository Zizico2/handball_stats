import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

async function watchForSkeletons(page: Page) {
  await page.evaluate(() => {
    const state = { mounted: false };
    (
      window as typeof window & { __instantNavSkeletons?: typeof state }
    ).__instantNavSkeletons = state;

    new MutationObserver(() => {
      if (document.querySelector(".skeleton")) {
        state.mounted = true;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function expectNoSkeletonNavigation(
  page: Page,
  navigate: () => Promise<void>,
  content: () => Promise<void>,
) {
  await watchForSkeletons(page);
  await navigate();
  await content();

  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __instantNavSkeletons?: { mounted: boolean };
          }
        ).__instantNavSkeletons?.mounted ?? false,
    ),
  ).toBe(false);
  await expect(page.locator(".skeleton")).toHaveCount(0);
}

test.describe("instant navigations", () => {
  test.skip(!hasAuth, "Requires CLERK_SECRET_KEY for Clerk testing helpers.");

  test("prefetched authenticated routes render real content without skeletons", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expectNoSkeletonNavigation(
      page,
      () => page.getByRole("link", { name: "Past Games" }).first().click(),
      async () => {
        await expect(page.getByText("E2E Home")).toBeVisible();
      },
    );

    await expectNoSkeletonNavigation(
      page,
      () => page.getByRole("link", { name: "Active Game" }).first().click(),
      async () => {
        await expect(
          page.getByText("No active game. Choose a home team first."),
        ).toBeVisible();
      },
    );

    await expectNoSkeletonNavigation(
      page,
      () => page.getByRole("link", { name: "New Game" }).first().click(),
      async () => {
        await expect(
          page.getByRole("heading", { name: "New Game" }),
        ).toBeVisible();
      },
    );

    await expectNoSkeletonNavigation(
      page,
      () => page.getByRole("link", { name: "Create Teams" }).first().click(),
      async () => {
        await expect(
          page.getByRole("button", { name: "Create Team" }),
        ).toBeVisible();
      },
    );

    await expectNoSkeletonNavigation(
      page,
      () => page.getByRole("link", { name: "Home" }).first().click(),
      async () => {
        await expect(page.getByTestId("home-hub")).toBeVisible();
      },
    );
  });

  test("past-game detail and warm revisits keep real content visible", async ({
    page,
  }) => {
    await page.goto("/past-games");
    await page.waitForLoadState("networkidle");

    const gameLink = page.locator('a[href^="/past-games/"]').first();
    await expect(gameLink).toBeVisible();
    await expectNoSkeletonNavigation(
      page,
      () => gameLink.click(),
      async () => {
        await expect(page.getByText("Match Log")).toBeVisible();
      },
    );

    await expectNoSkeletonNavigation(
      page,
      () => page.getByRole("link", { name: /Back to past games/i }).click(),
      async () => {
        await expect(page.getByText("E2E Home")).toBeVisible();
      },
    );

    await expectNoSkeletonNavigation(
      page,
      () => gameLink.click(),
      async () => {
        await expect(page.getByText("Match Log")).toBeVisible();
      },
    );
  });
});
