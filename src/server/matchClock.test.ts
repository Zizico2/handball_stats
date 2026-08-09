import { describe, expect, test } from "bun:test";
import { testClientId } from "@/testing/clientId";
import { buildMatchClockSnapshot, calculateElapsedMs } from "./matchClockLogic";

const FIRST_HALF_START_MS = 1_000_000;
const HALFTIME_MS = FIRST_HALF_START_MS + 30 * 60 * 1000;
const SECOND_HALF_START_MS = HALFTIME_MS + 10 * 60 * 1000;

describe("calculateElapsedMs", () => {
  test("returns zero when the half has not started", () => {
    expect(calculateElapsedMs(null, [], 8_000)).toBe(0);
  });

  test("subtracts completed pauses from elapsed time", () => {
    expect(calculateElapsedMs(1_000, [3_000, 5_000], 8_000)).toBe(5_000);
  });

  test("freezes elapsed time at the start of an open pause", () => {
    expect(calculateElapsedMs(1_000, [3_000], 8_000)).toBe(2_000);
  });

  test("clamps elapsed time to zero", () => {
    expect(calculateElapsedMs(1_000, [], 500)).toBe(0);
  });
});

describe("buildMatchClockSnapshot", () => {
  test("pre-match: no active half and zero elapsed", () => {
    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(1),
      nowMs: FIRST_HALF_START_MS,
      firstHalfStartedAtMs: null,
      halftimeStartedAtMs: null,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });

    expect(snapshot).toEqual({
      gameId: testClientId(1),
      serverNowMs: FIRST_HALF_START_MS,
      activeHalf: null,
      activeElapsedSeconds: 0,
      firstHalfElapsedSeconds: 0,
      secondHalfElapsedSeconds: 0,
      firstHalfPaused: false,
      secondHalfPaused: false,
    });
  });

  test("first half: active half advances with nowMs", () => {
    const nowMs = FIRST_HALF_START_MS + 125_000;

    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(2),
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      halftimeStartedAtMs: null,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBe("firstHalf");
    expect(snapshot.activeElapsedSeconds).toBe(125);
    expect(snapshot.firstHalfElapsedSeconds).toBe(125);
    expect(snapshot.secondHalfElapsedSeconds).toBe(0);
    expect(snapshot.firstHalfPaused).toBe(false);
  });

  test("halftime: no active half and first-half elapsed capped at HT", () => {
    const nowMs = HALFTIME_MS + 5 * 60 * 1000;

    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(3),
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      halftimeStartedAtMs: HALFTIME_MS,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBeNull();
    expect(snapshot.activeElapsedSeconds).toBe(0);
    expect(snapshot.firstHalfElapsedSeconds).toBe(30 * 60);
    expect(snapshot.secondHalfElapsedSeconds).toBe(0);
  });

  test("second half: active half is secondHalf; first half stays capped at HT", () => {
    const nowMs = SECOND_HALF_START_MS + 90_000;

    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(4),
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      halftimeStartedAtMs: HALFTIME_MS,
      secondHalfStartedAtMs: SECOND_HALF_START_MS,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBe("secondHalf");
    expect(snapshot.activeElapsedSeconds).toBe(90);
    expect(snapshot.firstHalfElapsedSeconds).toBe(30 * 60);
    expect(snapshot.secondHalfElapsedSeconds).toBe(90);
  });

  test("missing game / empty timestamps: null active half and zeros", () => {
    const nowMs = 5_000_000;

    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(99),
      nowMs,
      firstHalfStartedAtMs: null,
      halftimeStartedAtMs: null,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBeNull();
    expect(snapshot.activeElapsedSeconds).toBe(0);
    expect(snapshot.firstHalfElapsedSeconds).toBe(0);
    expect(snapshot.secondHalfElapsedSeconds).toBe(0);
    expect(snapshot.serverNowMs).toBe(nowMs);
  });

  test("first-half pause freezes elapsed before HT cap", () => {
    const pauseAtMs = FIRST_HALF_START_MS + 10 * 60 * 1000;
    const nowMs = HALFTIME_MS + 60_000;

    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(5),
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      halftimeStartedAtMs: HALFTIME_MS,
      secondHalfStartedAtMs: null,
      pauseToggles: [{ half: "firstHalf", toggledAtMs: pauseAtMs }],
    });

    expect(snapshot.activeHalf).toBeNull();
    expect(snapshot.firstHalfPaused).toBe(true);
    expect(snapshot.firstHalfElapsedSeconds).toBe(10 * 60);
    expect(snapshot.activeElapsedSeconds).toBe(0);
  });

  test("second half without HT: first half freezes at second-half start", () => {
    const secondHalfStartMs = FIRST_HALF_START_MS + 32 * 60 * 1000;
    const nowMs = secondHalfStartMs + 90_000;

    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(6),
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      halftimeStartedAtMs: null,
      secondHalfStartedAtMs: secondHalfStartMs,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBe("secondHalf");
    expect(snapshot.firstHalfElapsedSeconds).toBe(32 * 60);
    expect(snapshot.activeElapsedSeconds).toBe(90);
  });

  test("unsorted pause toggles are sorted before elapsed math", () => {
    const pauseAtMs = FIRST_HALF_START_MS + 5 * 60 * 1000;
    const resumeAtMs = FIRST_HALF_START_MS + 8 * 60 * 1000;
    const nowMs = FIRST_HALF_START_MS + 12 * 60 * 1000;

    const snapshot = buildMatchClockSnapshot({
      gameId: testClientId(7),
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      halftimeStartedAtMs: null,
      secondHalfStartedAtMs: null,
      pauseToggles: [
        { half: "firstHalf", toggledAtMs: resumeAtMs },
        { half: "firstHalf", toggledAtMs: pauseAtMs },
      ],
    });

    // 12m wall - 3m pause = 9m elapsed
    expect(snapshot.firstHalfElapsedSeconds).toBe(9 * 60);
    expect(snapshot.firstHalfPaused).toBe(false);
  });

  test("second half without first half: throws", () => {
    expect(() =>
      buildMatchClockSnapshot({
        gameId: testClientId(8),
        nowMs: 2_045_000,
        firstHalfStartedAtMs: null,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: 2_000_000,
        pauseToggles: [],
      }),
    ).toThrow(
      "Invalid match clock timestamps: later phase set without first half start",
    );
  });

  test("halftime without first half: throws", () => {
    expect(() =>
      buildMatchClockSnapshot({
        gameId: testClientId(9),
        nowMs: 2_045_000,
        firstHalfStartedAtMs: null,
        halftimeStartedAtMs: 2_000_000,
        secondHalfStartedAtMs: null,
        pauseToggles: [],
      }),
    ).toThrow(
      "Invalid match clock timestamps: later phase set without first half start",
    );
  });
});
