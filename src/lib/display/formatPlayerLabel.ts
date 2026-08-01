import type { ClientId } from "@/datamodel";

interface PlayerLike {
  number: number;
  name: string;
  teamId?: ClientId;
}

export function formatPlayerLabel(
  number: number,
  players?: PlayerLike[],
  teamId?: ClientId,
): string {
  if (!players) {
    return `#${number}`;
  }

  const player = players.find(
    (p) => p.number === number && (teamId === undefined || p.teamId === teamId),
  );

  return player ? `#${player.number} ${player.name}` : `#${number}`;
}

export function buildPlayerLabelMap(
  players: Array<{ number: number; name: string }>,
): Record<number, string> {
  return Object.fromEntries(
    players.map((player) => [
      player.number,
      `#${player.number} ${player.name}`,
    ]),
  );
}
