"use client";

import { useCallback, useMemo } from "react";
import {
  buildPlayerLabelMap,
  formatPlayerLabel,
} from "@/lib/display/formatPlayerLabel";

interface PlayerLike {
  number: number;
  name: string;
  teamId?: string;
}

export function usePlayerLabelMap(players: PlayerLike[], teamId?: string) {
  const filteredPlayers = useMemo(
    () =>
      teamId === undefined
        ? players
        : players.filter((player) => player.teamId === teamId),
    [players, teamId],
  );

  const labelMap = useMemo(
    () => buildPlayerLabelMap(filteredPlayers),
    [filteredPlayers],
  );

  const getPlayerLabel = useCallback(
    (number: number) =>
      labelMap[number] ?? formatPlayerLabel(number, filteredPlayers, teamId),
    [filteredPlayers, labelMap, teamId],
  );

  return { labelMap, getPlayerLabel };
}
