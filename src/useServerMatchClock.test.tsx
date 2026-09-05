import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { ActiveGame, Game, PauseToggle } from "@/datamodel";
import { testClientId } from "@/testing/clientId";

let pauseToggles: PauseToggle[] = [];
const useNowCalls: Array<{
  isActive: boolean;
  intervalMs: number;
  offsetMs: number;
}> = [];

mock.module("@/useAppCollections", () => ({
  useAppCollections: () => ({
    gamesCollection: {
      get: () => undefined,
      update: () => undefined,
      utils: { refetch: async () => undefined },
    },
    pauseTogglesCollection: {
      utils: { refetch: async () => undefined },
    },
  }),
}));

mock.module("@/collections", () => ({
  pauseTogglesLiveQuery: {},
}));

mock.module("@tanstack/react-db", () => ({
  useLiveSuspenseQuery: () => ({ data: pauseToggles }),
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

const { reconcileDisplayedMatchClock, useServerMatchClock } = await import(
  "@/useServerMatchClock"
);

const activeGame: ActiveGame = {
  id: 1,
  gameId: testClientId(42),
  homeTeamId: testClientId(7),
};

function ClockHarness({ game }: { game: Game }) {
  useServerMatchClock({
    activeGameData: activeGame,
    activeGameRecord: game,
    initialNowMs: 10_000,
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
    id: testClientId(42),
    homeTeamId: testClientId(7),
    createdAt: "2026-07-21T00:00:00.000Z",
    ...timestamps,
  };
}

describe("reconcileDisplayedMatchClock", () => {
  test("holds a one-second regression for the same game and half", () => {
    const displayed = {
      clockKey: "42:firstHalf",
      elapsedSeconds: 60,
    };

    expect(reconcileDisplayedMatchClock(displayed, "42:firstHalf", 59)).toBe(
      displayed,
    );
  });

  test("catches up and advances normally after a held regression", () => {
    const displayed = {
      clockKey: "42:firstHalf",
      elapsedSeconds: 60,
    };

    const caughtUp = reconcileDisplayedMatchClock(
      displayed,
      "42:firstHalf",
      60,
    );
    const advanced = reconcileDisplayedMatchClock(caughtUp, "42:firstHalf", 61);

    expect(caughtUp).toBe(displayed);
    expect(advanced).toEqual({
      clockKey: "42:firstHalf",
      elapsedSeconds: 61,
    });
  });

  test("resets when the active game or half changes", () => {
    const displayed = {
      clockKey: "42:firstHalf",
      elapsedSeconds: 1_800,
    };

    expect(reconcileDisplayedMatchClock(displayed, "42:secondHalf", 0)).toEqual(
      { clockKey: "42:secondHalf", elapsedSeconds: 0 },
    );
    expect(reconcileDisplayedMatchClock(displayed, "43:firstHalf", 0)).toEqual({
      clockKey: "43:firstHalf",
      elapsedSeconds: 0,
    });
  });

  test("re-anchors regressions of two seconds or more", () => {
    const displayed = {
      clockKey: "42:firstHalf",
      elapsedSeconds: 60,
    };

    expect(reconcileDisplayedMatchClock(displayed, "42:firstHalf", 58)).toEqual(
      { clockKey: "42:firstHalf", elapsedSeconds: 58 },
    );
  });
});

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
          id: testClientId(111),
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
