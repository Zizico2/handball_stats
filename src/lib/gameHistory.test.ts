import { describe, expect, test } from "bun:test";
import {
  clientIdSchema,
  type Game,
  type PlayerEvent,
  playerEventSchema,
  type Team,
  type TeamPlayer,
} from "@/datamodel";
import {
  buildPastGameLog,
  buildPastGameSummaries,
  playerEventsToCsv,
  toCsvCell,
} from "./gameHistory";

function id(value: string) {
  return clientIdSchema.parse(
    `00000000-0000-4000-8000-${value.padStart(12, "0")}`,
  );
}

function game(value: string, createdAt: string, homeTeamId: string): Game {
  return {
    id: id(value),
    homeTeamId: id(homeTeamId),
    createdAt,
  };
}

function team(value: string, name: string): Team {
  return { id: id(value), name };
}

function event(
  value: string,
  sequence: number | null,
  overrides: Record<string, unknown> = {},
): PlayerEvent {
  return playerEventSchema.parse({
    id: id(value),
    sequence,
    player: 7,
    game_id: id("1"),
    ellapsed_seconds: sequence ?? 0,
    half: "firstHalf",
    eventType: "shot",
    eventGroup: "attack",
    event: {
      goal: sequence === 1,
      direction: "OnTarget",
      position: "9m+",
    },
    ...overrides,
  });
}

describe("game history selectors", () => {
  test("filters the active game and derives scores, counts, names, and order", () => {
    const games = [
      game("1", "2026-01-01T00:00:00.000Z", "11"),
      game("2", "2026-02-01T00:00:00.000Z", "22"),
      game("3", "2025-12-01T00:00:00.000Z", "11"),
    ];
    const summaries = buildPastGameSummaries({
      games,
      teams: [team("11", "Red"), team("22", "Blue")],
      activeGame: {
        id: 1,
        gameId: games[0].id,
        homeTeamId: games[0].homeTeamId,
      },
      playerEvents: [
        event("101", 1, { game_id: games[1].id }),
        event("102", 2, {
          game_id: games[1].id,
          event: { goal: false, direction: "OffTarget", position: "6m+" },
        }),
      ],
    });

    expect(summaries).toEqual([
      {
        id: games[1].id,
        createdAt: games[1].createdAt,
        homeTeamName: "Blue",
        score: 1,
        eventCount: 2,
      },
      {
        id: games[2].id,
        createdAt: games[2].createdAt,
        homeTeamName: "Red",
        score: 0,
        eventCount: 0,
      },
    ]);
  });

  test("selects and orders one game's players and events", () => {
    const selectedGame = game("1", "2026-01-01T00:00:00.000Z", "11");
    const players: TeamPlayer[] = [
      { id: id("201"), teamId: id("11"), name: "Nine", number: 9 },
      { id: id("202"), teamId: id("11"), name: "Two", number: 2 },
      { id: id("203"), teamId: id("22"), name: "Other", number: 1 },
    ];
    const selectedEvents = [event("103", 2), event("102", 1)];

    const log = buildPastGameLog({
      gameId: selectedGame.id,
      games: [selectedGame],
      teams: [team("11", "Red")],
      teamPlayers: players,
      playerEvents: selectedEvents,
    });

    expect(log?.game.homeTeamName).toBe("Red");
    expect(log?.players.map((player) => player.number)).toEqual([2, 9]);
    expect(log?.events.map((item) => item.sequence)).toEqual([1, 2]);
    expect(
      buildPastGameLog({
        gameId: id("404"),
        games: [selectedGame],
        teams: [team("11", "Red")],
        teamPlayers: players,
        playerEvents: selectedEvents,
      }),
    ).toBeNull();
  });
});

describe("player event CSV", () => {
  test("keeps the shared column order and event-specific fields", () => {
    const csv = playerEventsToCsv([
      event("101", 1),
      event("102", 2, {
        eventType: "substitution",
        eventGroup: "substitution",
        event: { playerIn: 12 },
      }),
    ]);

    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(
      "player,ellapsedSeconds,eventType,eventGroup,half,shotGoal,shotDirection,shotAim,shotPosition,substitutionPlayerIn,suspensionServedBy,suspensionEndedSuspensionId",
    );
    expect(lines[1]).toContain("true,OnTarget,,9m+");
    expect(lines[2]).toContain("substitution,substitution,firstHalf,,,,,12,,");
  });

  test("escapes CSV cells containing delimiters and quotes", () => {
    expect(toCsvCell('hello,"world"\nnext')).toBe('"hello,""world""\nnext"');
  });
});
