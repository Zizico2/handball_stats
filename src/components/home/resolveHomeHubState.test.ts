import { describe, expect, test } from "bun:test";
import { resolveHomeHubState } from "@/components/home/resolveHomeHubState";
import { resolvePrimaryClockAction } from "@/inGameControlsAtoms";
import {
  formatClockRunningState,
  formatMatchPhase,
} from "@/lib/display/formatMatchPhase";
import { testClientId } from "@/testing/clientId";

describe("resolveHomeHubState", () => {
  test("create-team when there are no teams", () => {
    expect(
      resolveHomeHubState({
        teamCount: 0,
        readyTeamPlayerCount: 0,
        hasActiveGame: false,
        activeTeamName: null,
        recentGame: null,
      }).kind,
    ).toBe("create-team");
  });

  test("add-players when roster is empty", () => {
    expect(
      resolveHomeHubState({
        teamCount: 1,
        readyTeamPlayerCount: 0,
        hasActiveGame: false,
        activeTeamName: null,
        recentGame: null,
      }).kind,
    ).toBe("add-players");
  });

  test("start-game when a roster is ready", () => {
    expect(
      resolveHomeHubState({
        teamCount: 1,
        readyTeamPlayerCount: 2,
        hasActiveGame: false,
        activeTeamName: null,
        recentGame: { id: testClientId(3), homeTeamName: "E2E Home" },
      }),
    ).toMatchObject({
      kind: "start-game",
      ctaHref: "/new-game",
      recentGame: { id: testClientId(3), homeTeamName: "E2E Home" },
    });
  });

  test("resume-match when an active game exists", () => {
    expect(
      resolveHomeHubState({
        teamCount: 1,
        readyTeamPlayerCount: 2,
        hasActiveGame: true,
        activeTeamName: "E2E Home",
        recentGame: null,
      }),
    ).toMatchObject({
      kind: "resume-match",
      ctaHref: "/active-game",
      teamName: "E2E Home",
    });
  });
});

describe("resolvePrimaryClockAction", () => {
  test("starts first half before the match begins", () => {
    expect(
      resolvePrimaryClockAction({
        hasActiveGame: true,
        matchStatus: null,
        isRunning: false,
        isClockMutationPending: false,
        disableStartFirstHalf: false,
        disableStartSecondHalf: true,
      }),
    ).toEqual({
      action: "start-first-half",
      label: "Start first half",
      disabled: false,
    });
  });

  test("pauses and resumes during a half", () => {
    expect(
      resolvePrimaryClockAction({
        hasActiveGame: true,
        matchStatus: "firstHalf",
        isRunning: true,
        isClockMutationPending: false,
        disableStartFirstHalf: false,
        disableStartSecondHalf: true,
      }).label,
    ).toBe("Pause");

    expect(
      resolvePrimaryClockAction({
        hasActiveGame: true,
        matchStatus: "firstHalf",
        isRunning: false,
        isClockMutationPending: false,
        disableStartFirstHalf: false,
        disableStartSecondHalf: true,
      }).label,
    ).toBe("Resume");
  });
});

describe("formatMatchPhase", () => {
  test("labels phases and running state", () => {
    expect(formatMatchPhase("firstHalf")).toBe("First half");
    expect(formatMatchPhase(null)).toBe("Not started");
    expect(formatClockRunningState("firstHalf", true)).toBe("Running");
    expect(formatClockRunningState("firstHalf", false)).toBe("Paused");
    expect(formatClockRunningState("halftime", false)).toBe("Break");
  });
});
