import { expect, test } from "@playwright/test";
import { seedE2eData } from "./seedE2eData";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

const V1_HEADER =
  "format_version,record_type,match_external_id,match_started_at,tracked_team,opponent,player_number,player_name,event_sequence,half,elapsed_seconds,event_type,event_group,shot_goal,shot_direction,shot_aim,shot_position,substitution_player_in";

function v1Csv(externalId: string, startedAt: string): string {
  return [
    V1_HEADER,
    `arcazzi-game-v1,match,${externalId},${startedAt},E2E Imported Team,Rivals HC,,,,,,,,,,,,`,
    "arcazzi-game-v1,player,,,,,7,Alex,,,,,,,,,,",
    "arcazzi-game-v1,player,,,,,12,Blake,,,,,,,,,,",
    `arcazzi-game-v1,event,${externalId},,,,7,,0,firstHalf,95,shot,attack,true,OnTarget,TopLeft,9m+,`,
    `arcazzi-game-v1,event,${externalId},,,,12,,1,secondHalf,240,interception,defense,,,,,`,
    "",
  ].join("\n");
}

const INVALID_CSV = [
  V1_HEADER,
  "arcazzi-game-v1,match,match-x,2026-05-05T10:00:00Z,=EvilTeam,<img onerror=alert(1)>,,,,,,,,,,,,",
  "arcazzi-game-v1,player,,,,,7,Alex,,,,,,,,,,",
  "arcazzi-game-v1,event,match-x,,,,7,,0,thirdHalf,95,shot,attack,true,OnTarget,TopLeft,9m+,",
  "",
].join("\n");

test.describe("game import from CSV", () => {
  test.skip(!hasAuth, "Clerk credentials are required");

  test.beforeEach(async ({ request }) => {
    await seedE2eData(request);
  });

  test("dialog opens, template link exists, cancel writes nothing", async ({
    page,
  }) => {
    await page.goto("/past-games");
    await page.getByRole("button", { name: "Import game from CSV" }).click();
    await expect(
      page.getByRole("heading", { name: "Import game from CSV" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "downloadable template" }),
    ).toHaveAttribute("href", "/examples/arcazzi-game-v1.csv");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Import game from CSV" }),
    ).toBeHidden();
  });

  test("invalid file shows diagnostics with literal markup and no confirm", async ({
    page,
  }) => {
    await page.goto("/past-games");
    await page.getByRole("button", { name: "Import game from CSV" }).click();

    await page.locator("#game-import-file").setInputFiles({
      name: "invalid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(INVALID_CSV, "utf-8"),
    });

    // Needs a team first; pick the seeded one, then preview.
    await page
      .getByRole("button", { name: /Tracked team|Select your team/ })
      .click();
    await page.getByRole("option", { name: "E2E Home" }).click();
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByText("The file failed validation")).toBeVisible();
    await expect(page.getByText("thirdHalf")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import completed game" }),
    ).toBeHidden();
  });

  test("valid preview and confirm creates an Imported game, duplicates blocked", async ({
    page,
  }) => {
    const externalId = `e2e-${Date.now()}`;
    const startedAt = "2026-04-10T18:00:00Z";
    const csv = v1Csv(externalId, startedAt);

    await page.goto("/past-games");
    await page.getByRole("button", { name: "Import game from CSV" }).click();

    await page.locator("#game-import-file").setInputFiles({
      name: "match.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    await page
      .getByRole("button", { name: /Tracked team|Select your team/ })
      .click();
    await page.getByRole("option", { name: "E2E Home" }).click();
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByText("Ready to import")).toBeVisible();
    await expect(page.getByText("E2E Imported Team")).toBeVisible();

    await page.getByRole("button", { name: "Import completed game" }).click();

    await expect(page).toHaveURL(/\/past-games\/\d+/, { timeout: 20_000 });
    await expect(page.getByText("Imported")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /E2E Imported Team/ }),
    ).toBeVisible();

    // Back on the list, the imported card carries the badge.
    await page.goto("/past-games");
    await expect(page.getByText("Imported").first()).toBeVisible();

    // Re-importing the same file is blocked as an exact duplicate.
    await page.getByRole("button", { name: "Import game from CSV" }).click();
    await page.locator("#game-import-file").setInputFiles({
      name: "match.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });
    await page
      .getByRole("button", { name: /Tracked team|Select your team/ })
      .click();
    await page.getByRole("option", { name: "E2E Home" }).click();
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByText("Already imported")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import completed game" }),
    ).toBeDisabled();
  });
});
