import { describe, expect, test } from "bun:test";
import {
  applyPhaseTransitionAtomically,
  decidePhaseTransition,
  deriveGamePhase,
  type GamePhaseTimestamps,
} from "./gamePhaseTransitions";

const NOT_STARTED: GamePhaseTimestamps = {
  firstHalfStartedAtMs: null,
  halftimeStartedAtMs: null,
  secondHalfStartedAtMs: null,
};

const FIRST_HALF: GamePhaseTimestamps = {
  firstHalfStartedAtMs: 1_000,
  halftimeStartedAtMs: null,
  secondHalfStartedAtMs: null,
};

const HALFTIME: GamePhaseTimestamps = {
  firstHalfStartedAtMs: 1_000,
  halftimeStartedAtMs: 2_000,
  secondHalfStartedAtMs: null,
};

const SECOND_HALF: GamePhaseTimestamps = {
  firstHalfStartedAtMs: 1_000,
  halftimeStartedAtMs: 2_000,
  secondHalfStartedAtMs: 3_000,
};

const SECOND_HALF_SKIPPED_HT: GamePhaseTimestamps = {
  firstHalfStartedAtMs: 1_000,
  halftimeStartedAtMs: null,
  secondHalfStartedAtMs: 3_000,
};

describe("deriveGamePhase", () => {
  test("orders phases from timestamps", () => {
    expect(deriveGamePhase(NOT_STARTED)).toBe("notStarted");
    expect(deriveGamePhase(FIRST_HALF)).toBe("firstHalf");
    expect(deriveGamePhase(HALFTIME)).toBe("halftime");
    expect(deriveGamePhase(SECOND_HALF)).toBe("secondHalf");
    expect(deriveGamePhase(SECOND_HALF_SKIPPED_HT)).toBe("secondHalf");
  });
});

describe("decidePhaseTransition", () => {
  test("allows legal forward transitions", () => {
    expect(decidePhaseTransition(NOT_STARTED, "firstHalf")).toEqual({
      kind: "apply",
      column: "firstHalfStartedAtMs",
    });
    expect(decidePhaseTransition(FIRST_HALF, "halftime")).toEqual({
      kind: "apply",
      column: "halftimeStartedAtMs",
    });
    expect(decidePhaseTransition(FIRST_HALF, "secondHalf")).toEqual({
      kind: "apply",
      column: "secondHalfStartedAtMs",
    });
    expect(decidePhaseTransition(HALFTIME, "secondHalf")).toEqual({
      kind: "apply",
      column: "secondHalfStartedAtMs",
    });
  });

  test("treats same-phase re-apply as idempotent", () => {
    expect(decidePhaseTransition(FIRST_HALF, "firstHalf")).toEqual({
      kind: "idempotent",
    });
    expect(decidePhaseTransition(HALFTIME, "halftime")).toEqual({
      kind: "idempotent",
    });
    expect(decidePhaseTransition(SECOND_HALF, "secondHalf")).toEqual({
      kind: "idempotent",
    });
  });

  test("rejects backward and invalid transitions", () => {
    expect(decidePhaseTransition(FIRST_HALF, "firstHalf").kind).not.toBe(
      "conflict",
    );
    expect(decidePhaseTransition(HALFTIME, "firstHalf").kind).toBe("conflict");
    expect(decidePhaseTransition(SECOND_HALF, "firstHalf").kind).toBe(
      "conflict",
    );
    expect(decidePhaseTransition(SECOND_HALF, "halftime").kind).toBe(
      "conflict",
    );
    expect(decidePhaseTransition(NOT_STARTED, "halftime").kind).toBe(
      "conflict",
    );
    expect(decidePhaseTransition(NOT_STARTED, "secondHalf").kind).toBe(
      "conflict",
    );
    expect(decidePhaseTransition(SECOND_HALF_SKIPPED_HT, "halftime").kind).toBe(
      "conflict",
    );
  });
});

describe("applyPhaseTransitionAtomically", () => {
  test("applies first half with server timestamp", () => {
    const result = applyPhaseTransitionAtomically(NOT_STARTED, "firstHalf", 42);
    expect(result).toEqual({
      ok: true,
      idempotent: false,
      timestamps: {
        firstHalfStartedAtMs: 42,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: null,
      },
    });
  });

  test("second writer cannot regress after second half started", () => {
    const first = applyPhaseTransitionAtomically(
      FIRST_HALF,
      "secondHalf",
      3_000,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const staleHalftime = applyPhaseTransitionAtomically(
      first.timestamps,
      "halftime",
      2_500,
    );
    expect(staleHalftime.ok).toBe(false);

    const staleFirstHalf = applyPhaseTransitionAtomically(
      first.timestamps,
      "firstHalf",
      500,
    );
    expect(staleFirstHalf.ok).toBe(false);
  });

  test("concurrent first-half: first wins, second is idempotent", () => {
    const tabA = applyPhaseTransitionAtomically(NOT_STARTED, "firstHalf", 100);
    expect(tabA.ok).toBe(true);
    if (!tabA.ok) {
      return;
    }

    // Tab B still thought the match was not started, but DB now has first half.
    const tabB = applyPhaseTransitionAtomically(
      tabA.timestamps,
      "firstHalf",
      200,
    );
    expect(tabB).toEqual({
      ok: true,
      idempotent: true,
      timestamps: tabA.timestamps,
    });
    expect(tabB.ok && tabB.timestamps.firstHalfStartedAtMs).toBe(100);
  });

  test("stale tab cannot clear phases via invalid transition", () => {
    const advanced = applyPhaseTransitionAtomically(HALFTIME, "secondHalf", 9);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) {
      return;
    }

    // Stale tab still on first half tries to start HT — conflict, timestamps unchanged.
    const stale = applyPhaseTransitionAtomically(
      advanced.timestamps,
      "halftime",
      8,
    );
    expect(stale.ok).toBe(false);
    expect(advanced.timestamps.secondHalfStartedAtMs).toBe(9);
    expect(advanced.timestamps.halftimeStartedAtMs).toBe(2_000);
  });
});
