import { describe, expect, test } from "bun:test";
import type { QuickSubPair, TeamPlayer } from "@/datamodel";
import {
  filterQuickSubPairsForRoster,
  quickSubPairReferencesPlayer,
} from "@/lib/quickSubPairs";

const players: TeamPlayer[] = [
  { id: 1, teamId: 10, name: "Alex", number: 7 },
  { id: 2, teamId: 10, name: "Blair", number: 9 },
  { id: 3, teamId: 20, name: "Casey", number: 7 },
];

const pairs: QuickSubPair[] = [
  { id: 1, teamId: 10, playerNumberA: 7, playerNumberB: 9 },
  { id: 2, teamId: 10, playerNumberA: 9, playerNumberB: 11 },
  { id: 3, teamId: 20, playerNumberA: 7, playerNumberB: 9 },
];

describe("quickSubPairReferencesPlayer", () => {
  test("matches either side of a pair on the player's team", () => {
    expect(quickSubPairReferencesPlayer(pairs[0], players[0])).toBe(true);
    expect(quickSubPairReferencesPlayer(pairs[0], players[1])).toBe(true);
  });

  test("does not match the same jersey number on another team", () => {
    expect(quickSubPairReferencesPlayer(pairs[0], players[2])).toBe(false);
  });
});

describe("filterQuickSubPairsForRoster", () => {
  test("keeps only pairs whose two players are rostered on the pair's team", () => {
    expect(filterQuickSubPairsForRoster(pairs, players)).toEqual([pairs[0]]);
  });

  test("does not borrow a matching jersey number from another team", () => {
    expect(
      filterQuickSubPairsForRoster(
        [{ id: 4, teamId: 10, playerNumberA: 7, playerNumberB: 12 }],
        [players[0], { id: 4, teamId: 20, name: "Drew", number: 12 }],
      ),
    ).toEqual([]);
  });
});
