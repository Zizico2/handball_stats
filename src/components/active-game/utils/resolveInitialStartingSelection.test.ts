import { describe, expect, test } from "bun:test";
import { resolveInitialStartingSelection } from "@/components/active-game/utils/resolveInitialStartingSelection";

describe("resolveInitialStartingSelection", () => {
  test("uses saved starters when present, ignoring active players", () => {
    const result = resolveInitialStartingSelection(
      [7, 12],
      new Set([9, 12]),
      new Set([7, 9, 12]),
    );

    expect(result.selected).toEqual([7, 12]);
    expect(result.droppedCount).toBe(0);
  });

  test("falls back to active players when no saved starters", () => {
    const result = resolveInitialStartingSelection(
      [],
      new Set([9, 12]),
      new Set([7, 9, 12]),
    );

    expect(result.selected).toEqual([9, 12]);
    expect(result.droppedCount).toBe(0);
  });

  test("filters out numbers no longer on the roster and reports drops", () => {
    const result = resolveInitialStartingSelection(
      [],
      new Set([7, 12]),
      new Set([12, 9]),
    );

    expect(result.selected).toEqual([12]);
    expect(result.droppedCount).toBe(1);
  });

  test("drops missing saved starters against the current roster", () => {
    const result = resolveInitialStartingSelection(
      [7, 12, 3],
      new Set([9]),
      new Set([7, 12]),
    );

    expect(result.selected).toEqual([7, 12]);
    expect(result.droppedCount).toBe(1);
  });

  test("returns empty selection when nothing preferred is on the roster", () => {
    const result = resolveInitialStartingSelection(
      [],
      new Set([7, 12]),
      new Set([9]),
    );

    expect(result.selected).toEqual([]);
    expect(result.droppedCount).toBe(2);
  });
});
