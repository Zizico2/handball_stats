import { describe, expect, test } from "bun:test";
import type { QuickSubPair, TeamPlayer } from "@/datamodel";
import {
  filterQuickSubPairsForRoster,
  quickSubPairReferencesPlayer,
} from "@/lib/quickSubPairs";
import { testClientId } from "@/testing/clientId";

const TEAM_A = testClientId(10);
const TEAM_B = testClientId(20);

const players: TeamPlayer[] = [
  { id: testClientId(1), teamId: TEAM_A, name: "Alex", number: 7 },
  { id: testClientId(2), teamId: TEAM_A, name: "Blair", number: 9 },
  { id: testClientId(3), teamId: TEAM_B, name: "Casey", number: 7 },
];

const pairs: QuickSubPair[] = [
  { id: testClientId(4), teamId: TEAM_A, playerNumberA: 7, playerNumberB: 9 },
  { id: testClientId(5), teamId: TEAM_A, playerNumberA: 9, playerNumberB: 11 },
  { id: testClientId(6), teamId: TEAM_B, playerNumberA: 7, playerNumberB: 9 },
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
        [
          {
            id: testClientId(7),
            teamId: TEAM_A,
            playerNumberA: 7,
            playerNumberB: 12,
          },
        ],
        [
          players[0],
          { id: testClientId(8), teamId: TEAM_B, name: "Drew", number: 12 },
        ],
      ),
    ).toEqual([]);
  });
});
