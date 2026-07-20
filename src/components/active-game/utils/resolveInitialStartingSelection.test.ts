import { describe, expect, test } from "bun:test";
import { resolveInitialStartingSelection } from "@/components/active-game/utils/resolveInitialStartingSelection";

describe("resolveInitialStartingSelection", () => {
  test("uses saved starters when present, ignoring active players", () => {
    expect(
      resolveInitialStartingSelection(
        [7, 12],
        new Set([9, 12]),
        new Set([7, 9, 12]),
      ),
    ).toEqual([7, 12]);
  });

  test("falls back to active players when no saved starters", () => {
    expect(
      resolveInitialStartingSelection(
        [],
        new Set([9, 12]),
        new Set([7, 9, 12]),
      ),
    ).toEqual([9, 12]);
  });

  test("filters out numbers no longer on the roster", () => {
    expect(
      resolveInitialStartingSelection([], new Set([7, 12]), new Set([12, 9])),
    ).toEqual([12]);
  });
});
