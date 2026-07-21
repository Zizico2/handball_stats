import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { ActiveGame, Game, PauseToggle } from "@/datamodel";

let pauseToggles: PauseToggle[] = [];
const useNowCalls: Array<{
  isActive: boolean;
  intervalMs: number;
  offsetMs: number;
}> = [];

mock.module("@tanstack/react-db", () => ({
  useLiveSuspenseQuery: () => ({ data: pauseToggles }),
}));

mock.module("@/collections", () => ({
  gamesCollection: {
    get: () => undefined,
    update: () => undefined,
    utils: { refetch: async () => undefined },
  },
  pauseTogglesCollection: {
    utils: { refetch: async () => undefined },
  },
}));

mock.module("@/server/api/client", () => ({
  getMatchClockSnapshotQuery: async () => ({
    serverNowMs: 0,
  }),
  setGamePauseStateMutation: async () => ({ applied: true }),
  transitionGamePhaseMutation: async () => {
    throw new Error("Not used by this test");
  },
}));

mock.module("@/useNow", () => ({
  useNow: (isActive: boolean, intervalMs: number, offsetMs: number) => {
    useNowCalls.push({ isActive, intervalMs, offsetMs });
    return 10_000;
  },
}));

const { useServerMatchClock } = await import("@/useServerMatchClock");

const activeGame: ActiveGame = {
  id: 1,
  gameId: 42,
  homeTeamId: 7,
};

function ClockHarness({ game }: { game: Game }) {
  useServerMatchClock({
    activeGameData: activeGame,
    activeGameRecord: game,
    matchStatus: null,
    setMatchStatus: () => undefined,
  });

  return createElement("div");
}

function renderClock(game: Game, toggles: PauseToggle[] = []) {
  pauseToggles = toggles;
  renderToString(createElement(ClockHarness, { game }));
  return useNowCalls.at(-1);
}

function gameWithClock(
  timestamps: Pick<
    Game,
    "firstHalfStartedAtMs" | "halftimeStartedAtMs" | "secondHalfStartedAtMs"
  >,
): Game {
  return {
    id: 42,
    homeTeamId: 7,
    createdAt: "2026-07-21T00:00:00.000Z",
    ...timestamps,
  };
}

describe("useServerMatchClock timer activation", () => {
  beforeEach(() => {
    pauseToggles = [];
    useNowCalls.length = 0;
  });

  test("ticks while a match half is running", () => {
    const call = renderClock(
      gameWithClock({
        firstHalfStartedAtMs: 1_000,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: null,
      }),
    );

    expect(call).toEqual({ isActive: true, intervalMs: 1_000, offsetMs: 0 });
  });

  test("does not tick while the active half is paused", () => {
    const call = renderClock(
      gameWithClock({
        firstHalfStartedAtMs: 1_000,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: null,
      }),
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          gameId: activeGame.gameId,
          half: "firstHalf",
          toggledAtMs: 5_000,
        },
      ],
    );

    expect(call).toEqual({ isActive: false, intervalMs: 1_000, offsetMs: 0 });
  });

  test("does not tick during halftime", () => {
    const call = renderClock(
      gameWithClock({
        firstHalfStartedAtMs: 1_000,
        halftimeStartedAtMs: 5_000,
        secondHalfStartedAtMs: null,
      }),
    );

    expect(call).toEqual({ isActive: false, intervalMs: 1_000, offsetMs: 0 });
  });

  test("does not tick before the first half starts", () => {
    const call = renderClock(
      gameWithClock({
        firstHalfStartedAtMs: null,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: null,
      }),
    );

    expect(call).toEqual({ isActive: false, intervalMs: 1_000, offsetMs: 0 });
  });
});
