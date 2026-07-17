import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { persistImportedGameAtomic } from "@/server/gameImport";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { gameImportsRoutes } = await import("@/server/api/routes/gameImports");

const USER_ID = "user-game-import";
const OTHER_USER_ID = "user-game-import-other";
const TEAM_ID = 1;

const V1_HEADER =
  "format_version,record_type,match_external_id,match_started_at,tracked_team,opponent,player_number,player_name,event_sequence,half,elapsed_seconds,event_type,event_group,shot_goal,shot_direction,shot_aim,shot_position,substitution_player_in";

const VALID_V1_CSV = [
  V1_HEADER,
  "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,Rivals HC,,,,,,,,,,,,",
  "arcazzi-game-v1,player,,,,,7,Ana Silva,,,,,,,,,,",
  "arcazzi-game-v1,player,,,,,9,Bruna Costa,,,,,,,,,,",
  "arcazzi-game-v1,event,match-1,,,,7,,0,firstHalf,95,shot,attack,true,OnTarget,TopLeft,9m+,",
  "arcazzi-game-v1,event,match-1,,,,9,,1,secondHalf,240,interception,defense,,,,,",
  "",
].join("\n");

const LEGACY_HEADER =
  "player,ellapsedSeconds,eventType,eventGroup,half,shotGoal,shotDirection,shotAim,shotPosition,substitutionPlayerIn";

const VALID_LEGACY_CSV = [
  LEGACY_HEADER,
  "7,95,shot,attack,firstHalf,true,OnTarget,TopLeft,9m+,",
  "",
].join("\n");

async function seedTeam(userId = USER_ID, teamId = TEAM_ID) {
  const db = getTestDb();
  await db
    .insert(schema.teams)
    .values({ userId, localId: teamId, name: "Home" });
  await db.insert(schema.teamPlayers).values([
    {
      userId,
      localId: teamId * 100 + 1,
      teamLocalId: teamId,
      name: "Ana Silva",
      number: 7,
    },
    {
      userId,
      localId: teamId * 100 + 2,
      teamLocalId: teamId,
      name: "Bruna Costa",
      number: 9,
    },
  ]);
}

function importRequest(
  path: "/preview" | "/confirm",
  options: {
    csv?: string;
    filename?: string;
    fields?: Record<string, string>;
    userId?: string;
    omitFile?: boolean;
  } = {},
) {
  const form = new FormData();
  if (!options.omitFile) {
    form.set(
      "file",
      new File([options.csv ?? VALID_V1_CSV], options.filename ?? "match.csv", {
        type: "text/csv",
      }),
    );
  }
  for (const [key, value] of Object.entries(options.fields ?? {})) {
    form.set(key, value);
  }

  return gameImportsRoutes.request(
    path,
    { method: "POST", body: form },
    { userId: options.userId ?? USER_ID },
  );
}

async function countRows() {
  const db = getTestDb();
  const [games, snapshots, events, imports, active] = await Promise.all([
    db.select().from(schema.games),
    db.select().from(schema.gameRosterSnapshots),
    db.select().from(schema.playerEvents),
    db.select().from(schema.gameImports),
    db.select().from(schema.activeGame),
  ]);
  return {
    games: games.length,
    snapshots: snapshots.length,
    events: events.length,
    imports: imports.length,
    active: active.length,
  };
}

async function previewFingerprint(
  csv: string,
  fields: Record<string, string> = { homeTeamId: String(TEAM_ID) },
  userId = USER_ID,
): Promise<string> {
  const res = await importRequest("/preview", { csv, fields, userId });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { status: string; fingerprint: string };
  expect(body.status).toBe("ready");
  return body.fingerprint;
}

describe("game imports API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
    await seedTeam();
  });

  test("preview valid v1 returns counts and writes nothing", async () => {
    const res = await importRequest("/preview", {
      fields: { homeTeamId: String(TEAM_ID) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ready");
    expect(body.formatVersion).toBe("arcazzi-game-v1");
    expect(body.playerCount).toBe(2);
    expect(body.eventCount).toBe(2);
    expect(body.goalCount).toBe(1);
    expect(body.trackedTeamName).toBe("Arcazzi");
    expect(body.opponentName).toBe("Rivals HC");
    expect(String(body.fingerprint)).toMatch(/^[0-9a-f]{64}$/);
    expect((body.duplicate as { kind: string }).kind).toBe("none");

    expect(await countRows()).toEqual({
      games: 0,
      snapshots: 0,
      events: 0,
      imports: 0,
      active: 0,
    });
  });

  test("preview without a team returns needs_metadata", async () => {
    const res = await importRequest("/preview");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; missing: string[] };
    expect(body.status).toBe("needs_metadata");
    expect(body.missing).toContain("homeTeamId");
  });

  test("preview invalid file returns 422 diagnostics and writes nothing", async () => {
    const invalid = VALID_V1_CSV.replace("firstHalf,95", "thirdHalf,95");
    const res = await importRequest("/preview", {
      csv: invalid,
      fields: { homeTeamId: String(TEAM_ID) },
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      status: string;
      diagnostics: Array<{ row: number | null; column: string | null }>;
    };
    expect(body.status).toBe("invalid");
    expect(body.diagnostics.length).toBeGreaterThan(0);
    expect(body.diagnostics[0].row).not.toBeNull();
    expect(body.diagnostics[0].column).toBe("half");
    expect(await countRows()).toEqual({
      games: 0,
      snapshots: 0,
      events: 0,
      imports: 0,
      active: 0,
    });
  });

  test("legacy preview needs metadata, then becomes ready", async () => {
    const first = await importRequest("/preview", { csv: VALID_LEGACY_CSV });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      status: string;
      formatVersion: string;
      missing: string[];
    };
    expect(firstBody.status).toBe("needs_metadata");
    expect(firstBody.formatVersion).toBe("legacy-event-log-v0");
    expect(firstBody.missing).toEqual(
      expect.arrayContaining(["homeTeamId", "matchDate"]),
    );

    const second = await importRequest("/preview", {
      csv: VALID_LEGACY_CSV,
      fields: {
        homeTeamId: String(TEAM_ID),
        matchDate: "2026-03-01",
        opponent: "Rivals HC",
      },
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as Record<string, unknown>;
    expect(secondBody.status).toBe("ready");
    expect(secondBody.matchStartedAt).toBe("2026-03-01T12:00:00.000Z");
    expect(secondBody.trackedTeamName).toBe("Home");
    expect(secondBody.playerCount).toBe(2);
  });

  test("legacy preview with unknown roster number is 422", async () => {
    const res = await importRequest("/preview", {
      csv: VALID_LEGACY_CSV.replace("7,95", "42,95"),
      fields: { homeTeamId: String(TEAM_ID), matchDate: "2026-03-01" },
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      diagnostics: Array<{ code: string }>;
    };
    expect(body.diagnostics.map((d) => d.code)).toContain(
      "PLAYER_NOT_IN_ROSTER",
    );
  });

  test("confirm writes game, snapshots, events, provenance atomically", async () => {
    const fingerprint = await previewFingerprint(VALID_V1_CSV);
    const res = await importRequest("/confirm", {
      filename: "/tmp/dir/My Match.csv",
      fields: {
        homeTeamId: String(TEAM_ID),
        previewFingerprint: fingerprint,
      },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { gameId: number; source: string };
    expect(body.source).toBe("imported");

    const db = getTestDb();
    const game = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.localId, body.gameId))
      .get();
    expect(game).toBeDefined();
    expect(game?.source).toBe("imported");
    expect(game?.opponentName).toBe("Rivals HC");
    expect(game?.trackedTeamName).toBe("Arcazzi");
    expect(game?.createdAt).toBe("2026-03-01T18:30:00.000Z");
    expect(Number.isSafeInteger(body.gameId)).toBe(true);

    const snapshots = await db
      .select()
      .from(schema.gameRosterSnapshots)
      .where(eq(schema.gameRosterSnapshots.gameLocalId, body.gameId));
    expect(snapshots.map((s) => [s.playerNumber, s.playerName]).sort()).toEqual(
      [
        [7, "Ana Silva"],
        [9, "Bruna Costa"],
      ],
    );

    const events = await db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.gameLocalId, body.gameId));
    expect(events).toHaveLength(2);
    const shot = events.find((event) => event.eventType === "shot");
    expect(shot?.shotGoal).toBe(true);
    expect(shot?.shotPosition).toBe("9m+");

    const provenance = await db
      .select()
      .from(schema.gameImports)
      .where(eq(schema.gameImports.gameLocalId, body.gameId))
      .get();
    expect(provenance?.formatVersion).toBe("arcazzi-game-v1");
    expect(provenance?.fingerprint).toBe(fingerprint);
    expect(provenance?.originalFilename).toBe("My Match.csv");
    expect(provenance?.importedAt).toBeTruthy();

    const active = await db.select().from(schema.activeGame);
    expect(active).toHaveLength(0);
  });

  test("confirm leaves an existing active game untouched", async () => {
    const db = getTestDb();
    await db.insert(schema.games).values({
      userId: USER_ID,
      localId: 500,
      homeTeamLocalId: TEAM_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await db.insert(schema.activeGame).values({
      userId: USER_ID,
      localId: 1,
      gameLocalId: 500,
      homeTeamLocalId: TEAM_ID,
    });
    const before = await db.select().from(schema.activeGame);

    const fingerprint = await previewFingerprint(VALID_V1_CSV);
    const res = await importRequest("/confirm", {
      fields: { homeTeamId: String(TEAM_ID), previewFingerprint: fingerprint },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { gameId: number };

    const after = await db.select().from(schema.activeGame);
    expect(after).toEqual(before);
    expect(after[0].gameLocalId).toBe(500);
    expect(body.gameId).not.toBe(500);
  });

  test("a failing statement rolls back the whole batch", async () => {
    const db = getTestDb();
    await expect(
      persistImportedGameAtomic(db, USER_ID, {
        canonical: {
          formatVersion: "arcazzi-game-v1",
          matchExternalId: "match-1",
          matchStartedAt: "2026-03-01T18:30:00.000Z",
          trackedTeamName: "Arcazzi",
          opponentName: null,
          roster: [{ number: 7, name: "Ana Silva" }],
          events: [],
          goalCount: 0,
        },
        homeTeamId: TEAM_ID,
        // Violates the 64-char fingerprint CHECK on the final insert.
        fingerprint: "short",
        sanitizedFilename: "match.csv",
        importedAt: "2026-03-02T00:00:00.000Z",
      }),
    ).rejects.toThrow();

    expect(await countRows()).toEqual({
      games: 0,
      snapshots: 0,
      events: 0,
      imports: 0,
      active: 0,
    });
  });

  test("exact repeated confirm returns 409 with existing game id", async () => {
    const fingerprint = await previewFingerprint(VALID_V1_CSV);
    const first = await importRequest("/confirm", {
      fields: { homeTeamId: String(TEAM_ID), previewFingerprint: fingerprint },
    });
    expect(first.status).toBe(201);
    const { gameId } = (await first.json()) as { gameId: number };

    const second = await importRequest("/confirm", {
      fields: { homeTeamId: String(TEAM_ID), previewFingerprint: fingerprint },
    });
    expect(second.status).toBe(409);
    const body = (await second.json()) as {
      code: string;
      existingGameId: number;
    };
    expect(body.code).toBe("EXACT_DUPLICATE");
    expect(body.existingGameId).toBe(gameId);

    expect((await countRows()).games).toBe(1);
  });

  test("likely duplicate requires explicit acknowledgement", async () => {
    const fingerprint = await previewFingerprint(VALID_V1_CSV);
    await importRequest("/confirm", {
      fields: { homeTeamId: String(TEAM_ID), previewFingerprint: fingerprint },
    });

    // Same team/date/opponent, different content.
    const variant = VALID_V1_CSV.replace("TopLeft", "TopRight");
    const variantFingerprint = await previewFingerprint(variant);
    expect(variantFingerprint).not.toBe(fingerprint);

    const blocked = await importRequest("/confirm", {
      csv: variant,
      fields: {
        homeTeamId: String(TEAM_ID),
        previewFingerprint: variantFingerprint,
      },
    });
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as { code: string }).code).toBe(
      "LIKELY_DUPLICATE",
    );

    const allowed = await importRequest("/confirm", {
      csv: variant,
      fields: {
        homeTeamId: String(TEAM_ID),
        previewFingerprint: variantFingerprint,
        allowLikelyDuplicate: "true",
      },
    });
    expect(allowed.status).toBe(201);
    expect((await countRows()).games).toBe(2);
  });

  test("changed file after preview returns PREVIEW_STALE and writes nothing", async () => {
    const fingerprint = await previewFingerprint(VALID_V1_CSV);
    const res = await importRequest("/confirm", {
      csv: VALID_V1_CSV.replace("TopLeft", "TopRight"),
      fields: { homeTeamId: String(TEAM_ID), previewFingerprint: fingerprint },
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("PREVIEW_STALE");
    expect((await countRows()).games).toBe(0);
  });

  test("another user's team id is rejected", async () => {
    await seedTeam(OTHER_USER_ID, 2);
    const res = await importRequest("/preview", {
      fields: { homeTeamId: "2" },
    });
    expect(res.status).toBe(404);
  });

  test("the same file can be imported once by each user", async () => {
    await seedTeam(OTHER_USER_ID, 2);

    const fingerprintA = await previewFingerprint(VALID_V1_CSV);
    const first = await importRequest("/confirm", {
      fields: { homeTeamId: String(TEAM_ID), previewFingerprint: fingerprintA },
    });
    expect(first.status).toBe(201);

    const fingerprintB = await previewFingerprint(
      VALID_V1_CSV,
      { homeTeamId: "2" },
      OTHER_USER_ID,
    );
    const second = await importRequest("/confirm", {
      userId: OTHER_USER_ID,
      fields: { homeTeamId: "2", previewFingerprint: fingerprintB },
    });
    expect(second.status).toBe(201);
  });

  test("transport failures return documented statuses", async () => {
    const missing = await importRequest("/preview", { omitFile: true });
    expect(missing.status).toBe(415);

    const wrongExtension = await importRequest("/preview", {
      filename: "match.xlsx",
    });
    expect(wrongExtension.status).toBe(415);

    const oversized = await importRequest("/preview", {
      csv: `${V1_HEADER}\n${"x".repeat(2 * 1024 * 1024)}`,
    });
    expect(oversized.status).toBe(413);

    const confirmWithoutFingerprint = await importRequest("/confirm", {
      fields: { homeTeamId: String(TEAM_ID) },
    });
    expect(confirmWithoutFingerprint.status).toBe(422);
  });
});
