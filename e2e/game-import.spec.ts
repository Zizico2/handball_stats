import { expect, type APIRequestContext, type Page, test } from "@playwright/test";
import { refreshE2eSession } from "./e2eAuth";
import { E2E_TEAM_ID, seedE2eData } from "./seedE2eData";

const hasAuth = Boolean(process.env.CLERK_SECRET_KEY);

const V1_HEADER =
  "format_version,record_type,match_external_id,match_started_at,tracked_team,opponent,player_number,player_name,event_sequence,half,elapsed_seconds,event_type,event_group,shot_goal,shot_direction,shot_aim,shot_position,substitution_player_in";

function v1Csv(
  externalId: string,
  startedAt: string,
  opponent: string,
): string {
  return [
    V1_HEADER,
    `arcazzi-game-v1,match,${externalId},${startedAt},E2E Imported Team,${opponent},,,,,,,,,,,,`,
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

function uniqueCsv() {
  const stamp = Date.now();
  // Unique opponent avoids "likely duplicate" conflicts with prior CI imports
  // on the shared preview DB (same team + calendar day + opponent).
  const opponent = `Rivals ${stamp}`;
  const startedAt = new Date(stamp).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    csv: v1Csv(`e2e-${stamp}`, startedAt, opponent),
    opponent,
  };
}

async function chooseTrackedTeam(page: Page) {
  // Auto-preview after file upload must finish before the metadata Select mounts.
  const trigger = page.getByLabel("Tracked team");
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Preview import" }),
  ).toBeVisible();

  const option = page.getByRole("option", { name: "E2E Home" });
  for (let attempt = 0; attempt < 2; attempt++) {
    await trigger.click({ timeout: 5_000 });
    try {
      await expect(option).toBeVisible({ timeout: 5_000 });
      await option.click();
      return;
    } catch {
      await page.keyboard.press("Escape");
    }
  }
  throw new Error('Could not select tracked team "E2E Home"');
}

async function seedImportedGameViaApi(
  request: APIRequestContext,
  csv: string,
) {
  const file = {
    name: "match.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  };

  const preview = await request.post("/api/game-imports/preview", {
    multipart: {
      file,
      homeTeamId: String(E2E_TEAM_ID),
    },
  });
  expect(preview.ok(), await preview.text()).toBeTruthy();
  const previewBody = (await preview.json()) as {
    status: string;
    fingerprint?: string;
  };
  expect(previewBody.status).toBe("ready");
  expect(previewBody.fingerprint).toBeTruthy();

  const confirm = await request.post("/api/game-imports/confirm", {
    multipart: {
      file,
      homeTeamId: String(E2E_TEAM_ID),
      previewFingerprint: previewBody.fingerprint as string,
      allowLikelyDuplicate: "false",
    },
  });
  expect(confirm.status(), await confirm.text()).toBe(201);
}

test.describe("game import from CSV", () => {
  test.skip(!hasAuth, "Clerk credentials are required");

  test.beforeEach(async ({ page }) => {
    const request = await refreshE2eSession(page);
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
    test.setTimeout(90_000);
    await page.goto("/past-games");
    await page.getByRole("button", { name: "Import game from CSV" }).click();

    await page.locator("#game-import-file").setInputFiles({
      name: "invalid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(INVALID_CSV, "utf-8"),
    });

    await chooseTrackedTeam(page);
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByText("The file failed validation")).toBeVisible();
    await expect(page.getByText("thirdHalf")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import completed game" }),
    ).toBeHidden();
  });

  test("valid preview and confirm creates an Imported game", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const { csv, opponent } = uniqueCsv();

    await page.goto("/past-games");
    await page.getByRole("button", { name: "Import game from CSV" }).click();

    await page.locator("#game-import-file").setInputFiles({
      name: "match.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    await chooseTrackedTeam(page);
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByText("Ready to import")).toBeVisible();
    await expect(
      page.getByText("E2E Imported Team", { exact: true }),
    ).toBeVisible();

    const importButton = page.getByRole("button", {
      name: "Import completed game",
    });
    await expect(importButton).toBeEnabled({ timeout: 5_000 });
    await importButton.click();

    await expect(page).toHaveURL(/\/past-games\/\d+/, { timeout: 20_000 });
    await expect(page.getByText("Imported", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: `E2E Imported Team vs ${opponent}`,
      }),
    ).toBeVisible();

    await page.goto("/past-games");
    await expect(
      page.getByText("Imported", { exact: true }).first(),
    ).toBeVisible();
  });

  test("re-importing the same file is blocked as Already imported", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const { csv } = uniqueCsv();

    // Seed the first import via API so this test only exercises the UI
    // duplicate path (avoids a 60s+ double wizard that flakes on Select).
    const authed = await refreshE2eSession(page);
    await seedImportedGameViaApi(authed, csv);

    await page.goto("/past-games");
    await page.getByRole("button", { name: "Import game from CSV" }).click();
    await page.locator("#game-import-file").setInputFiles({
      name: "match.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });
    await chooseTrackedTeam(page);
    await page.getByRole("button", { name: "Preview import" }).click();

    await expect(
      page.getByText("Already imported", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import completed game" }),
    ).toBeDisabled();
  });
});
