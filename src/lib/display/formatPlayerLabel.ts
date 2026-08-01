interface PlayerLike {
  number: number;
  name: string;
  teamId?: string;
}

export function formatPlayerLabel(
  number: number,
  players?: PlayerLike[],
  teamId?: string,
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
