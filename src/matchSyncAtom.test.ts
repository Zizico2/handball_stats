import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import { getDefaultStore } from "jotai";
import {
  beginMatchSaving,
  clearMatchSync,
  isMatchSyncChipVisible,
  markMatchFailed,
  markMatchSaved,
  matchSyncAtom,
  SAVED_FLASH_MS,
  SAVING_DELAY_MS,
} from "@/matchSyncAtom";

function syncState() {
  return getDefaultStore().get(matchSyncAtom);
}

describe("matchSyncAtom delay-gated chip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMatchSync();
  });

  afterEach(() => {
    clearMatchSync();
    vi.useRealTimers();
  });

  test("fast success never shows the chip", () => {
    beginMatchSaving();
    expect(syncState().status).toBe("saving");
    expect(syncState().savingVisible).toBe(false);
    expect(isMatchSyncChipVisible(syncState())).toBe(false);

    vi.advanceTimersByTime(SAVING_DELAY_MS - 1);
    expect(syncState().savingVisible).toBe(false);
    expect(isMatchSyncChipVisible(syncState())).toBe(false);

    markMatchSaved();
    expect(syncState().status).toBe("idle");
    expect(isMatchSyncChipVisible(syncState())).toBe(false);

    vi.advanceTimersByTime(SAVING_DELAY_MS + SAVED_FLASH_MS);
    expect(syncState().status).toBe("idle");
    expect(isMatchSyncChipVisible(syncState())).toBe(false);
  });

  test("slow success shows saving, then saved, then idle", () => {
    beginMatchSaving();
    expect(isMatchSyncChipVisible(syncState())).toBe(false);

    vi.advanceTimersByTime(SAVING_DELAY_MS);
    expect(syncState().status).toBe("saving");
    expect(syncState().savingVisible).toBe(true);
    expect(isMatchSyncChipVisible(syncState())).toBe(true);

    markMatchSaved();
    expect(syncState().status).toBe("saved");
    expect(isMatchSyncChipVisible(syncState())).toBe(true);

    vi.advanceTimersByTime(SAVED_FLASH_MS - 1);
    expect(syncState().status).toBe("saved");
    expect(isMatchSyncChipVisible(syncState())).toBe(true);

    vi.advanceTimersByTime(1);
    expect(syncState().status).toBe("idle");
    expect(isMatchSyncChipVisible(syncState())).toBe(false);
  });

  test("failed shows the chip immediately without waiting for the delay", () => {
    beginMatchSaving();
    expect(isMatchSyncChipVisible(syncState())).toBe(false);

    markMatchFailed("Could not save", null);
    expect(syncState().status).toBe("failed");
    expect(syncState().savingVisible).toBe(false);
    expect(isMatchSyncChipVisible(syncState())).toBe(true);

    vi.advanceTimersByTime(SAVING_DELAY_MS);
    expect(syncState().status).toBe("failed");
    expect(isMatchSyncChipVisible(syncState())).toBe(true);
  });
});
