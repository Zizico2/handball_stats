import type { QuickSubPair, TeamPlayer } from "@/datamodel";

export function quickSubPairReferencesPlayer(
  pair: QuickSubPair,
  player: TeamPlayer,
): boolean {
  return (
    pair.teamId === player.teamId &&
    (pair.playerNumberA === player.number ||
      pair.playerNumberB === player.number)
  );
}

export function filterQuickSubPairsForRoster(
  pairs: QuickSubPair[],
  players: TeamPlayer[],
): QuickSubPair[] {
  const rosterKeys = new Set(
    players.map((player) => `${player.teamId}:${player.number}`),
  );

  return pairs.filter(
    (pair) =>
      rosterKeys.has(`${pair.teamId}:${pair.playerNumberA}`) &&
      rosterKeys.has(`${pair.teamId}:${pair.playerNumberB}`),
  );
}
