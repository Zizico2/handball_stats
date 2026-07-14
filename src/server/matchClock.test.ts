import { describe, expect, test } from "bun:test";
import { buildMatchClockSnapshot } from "./matchClockLogic";

const FIRST_HALF_START_MS = 1_000_000;
const SECOND_HALF_START_MS = FIRST_HALF_START_MS + 40 * 60 * 1000;

describe("buildMatchClockSnapshot", () => {
  test("pre-match: no active half and zero elapsed", () => {
    const snapshot = buildMatchClockSnapshot({
      gameId: 1,
      nowMs: FIRST_HALF_START_MS,
      firstHalfStartedAtMs: null,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });

    expect(snapshot).toEqual({
      gameId: 1,
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
      gameId: 2,
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBe("firstHalf");
    expect(snapshot.activeElapsedSeconds).toBe(125);
    expect(snapshot.firstHalfElapsedSeconds).toBe(125);
    expect(snapshot.secondHalfElapsedSeconds).toBe(0);
    expect(snapshot.firstHalfPaused).toBe(false);
  });

  test("second half: active half is secondHalf", () => {
    const nowMs = SECOND_HALF_START_MS + 90_000;

    const snapshot = buildMatchClockSnapshot({
      gameId: 4,
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      secondHalfStartedAtMs: SECOND_HALF_START_MS,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBe("secondHalf");
    expect(snapshot.activeElapsedSeconds).toBe(90);
    expect(snapshot.secondHalfElapsedSeconds).toBe(90);
  });

  test("missing game / empty timestamps: null active half and zeros", () => {
    const nowMs = 5_000_000;

    const snapshot = buildMatchClockSnapshot({
      gameId: 99,
      nowMs,
      firstHalfStartedAtMs: null,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });

    expect(snapshot.activeHalf).toBeNull();
    expect(snapshot.activeElapsedSeconds).toBe(0);
    expect(snapshot.firstHalfElapsedSeconds).toBe(0);
    expect(snapshot.secondHalfElapsedSeconds).toBe(0);
    expect(snapshot.serverNowMs).toBe(nowMs);
  });

  test("first-half pause freezes elapsed", () => {
    const pauseAtMs = FIRST_HALF_START_MS + 10 * 60 * 1000;
    const nowMs = FIRST_HALF_START_MS + 30 * 60 * 1000;

    const snapshot = buildMatchClockSnapshot({
      gameId: 5,
      nowMs,
      firstHalfStartedAtMs: FIRST_HALF_START_MS,
      secondHalfStartedAtMs: null,
      pauseToggles: [{ half: "firstHalf", toggledAtMs: pauseAtMs }],
    });

    expect(snapshot.activeHalf).toBe("firstHalf");
    expect(snapshot.firstHalfPaused).toBe(true);
    expect(snapshot.firstHalfElapsedSeconds).toBe(10 * 60);
    expect(snapshot.activeElapsedSeconds).toBe(10 * 60);
  });
});
