import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import * as schema from "@/db/schema";
import { getTestDb, resetAppTables } from "./db";

/**
 * Proves the D1-compatible games rebuild pattern used by
 * `20260717024950_simple_starjammers` works on a populated database.
 * D1 ignores `PRAGMA foreign_keys=OFF`; `defer_foreign_keys` is required.
 */
describe("games source migration on populated D1", () => {
  beforeEach(async () => {
    await resetAppTables();
  });

  test("defer_foreign_keys allows rebuilding games while children exist", async () => {
    const db = getTestDb();
    await db.insert(schema.teams).values({
      userId: "user-migrate",
      localId: 1,
      name: "Home",
    });
    await db.insert(schema.games).values({
      userId: "user-migrate",
      localId: 10,
      homeTeamLocalId: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      source: "recorded",
      opponentName: null,
      trackedTeamName: "Home",
    });
    await db.insert(schema.activeGame).values({
      userId: "user-migrate",
      localId: 1,
      gameLocalId: 10,
      homeTeamLocalId: 1,
    });
    await db.insert(schema.playerEvents).values({
      userId: "user-migrate",
      localId: 1,
      player: 7,
      gameLocalId: 10,
      ellapsedSeconds: 0,
      eventType: "startingPlayer",
      eventGroup: "substitution",
      half: "firstHalf",
      shotGoal: null,
      shotDirection: null,
      shotAim: null,
      shotPosition: null,
      substitutionPlayerIn: null,
      eventSequence: null,
    });

    // Mirror the migration rebuild with defer_foreign_keys (not foreign_keys=OFF).
    await env.DB.batch([
      env.DB.prepare("PRAGMA defer_foreign_keys = on"),
      env.DB.prepare(`
        CREATE TABLE __new_games (
          id integer PRIMARY KEY,
          user_id text NOT NULL,
          local_id integer NOT NULL,
          home_team_local_id integer NOT NULL,
          created_at text NOT NULL,
          first_half_started_at_ms integer,
          halftime_started_at_ms integer,
          second_half_started_at_ms integer,
          source text DEFAULT 'recorded' NOT NULL,
          opponent_name text,
          tracked_team_name text,
          FOREIGN KEY (user_id, home_team_local_id) REFERENCES teams(user_id, local_id),
          CHECK(source IN ('recorded', 'imported'))
        )
      `),
      env.DB.prepare(`
        INSERT INTO __new_games(
          id, user_id, local_id, home_team_local_id, created_at,
          first_half_started_at_ms, halftime_started_at_ms, second_half_started_at_ms,
          source, opponent_name, tracked_team_name
        )
        SELECT
          id, user_id, local_id, home_team_local_id, created_at,
          first_half_started_at_ms, halftime_started_at_ms, second_half_started_at_ms,
          source, opponent_name, tracked_team_name
        FROM games
      `),
      env.DB.prepare("DROP TABLE games"),
      env.DB.prepare("ALTER TABLE __new_games RENAME TO games"),
      env.DB.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS games_user_id_local_id_uq ON games (user_id, local_id)",
      ),
      env.DB.prepare("PRAGMA defer_foreign_keys = off"),
    ]);

    const games = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, "user-migrate"));
    expect(games).toHaveLength(1);
    expect(games[0].source).toBe("recorded");
    expect(games[0].trackedTeamName).toBe("Home");

    const active = await db.select().from(schema.activeGame);
    expect(active).toHaveLength(1);
    expect(active[0].gameLocalId).toBe(10);

    const events = await db.select().from(schema.playerEvents);
    expect(events).toHaveLength(1);
    expect(events[0].gameLocalId).toBe(10);
  });
});
