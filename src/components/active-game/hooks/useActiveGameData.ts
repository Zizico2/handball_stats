"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import {
  activeGameCollection,
  gamesCollection,
  playerEventsCollection,
  quickSubPairsCollection,
  teamPlayersCollection,
} from "@/collections";
import { getActivePlayers } from "@/components/active-game/utils/activePlayers";
import { useNextLocalId } from "@/hooks/useNextLocalId";
import type { MatchStatus } from "@/inGameControlsAtoms";

export function useActiveGameData(matchStatus: MatchStatus | null) {
  const playerEvents = useLiveSuspenseQuery((q) =>
    q.from({ event: playerEventsCollection }),
  );

  const games = useLiveSuspenseQuery((q) => q.from({ game: gamesCollection }));

  const activeGame = useLiveSuspenseQuery((q) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
  );

  const teamPlayers = useLiveSuspenseQuery((q) =>
    q.from({ player: teamPlayersCollection }),
  );

  const quickSubPairs = useLiveSuspenseQuery((q) =>
    q.from({ pair: quickSubPairsCollection }),
  );

  const lastEvent = useLiveSuspenseQuery((q) =>
    q
      .from({ event: playerEventsCollection })
      .orderBy(({ event }) => event.id, "desc")
      .findOne(),
  );

  const nextEventId = useNextLocalId(lastEvent);

  const activeGameData = activeGame.data ?? null;

  const activeGameRecord = useMemo(
    () =>
      activeGameData
        ? (games.data.find((game) => game.id === activeGameData.gameId) ?? null)
        : null,
    [activeGameData, games.data],
  );

  const selectedTeamPlayers = useMemo(
    () =>
      teamPlayers.data
        .filter((player) => player.teamId === activeGame.data?.homeTeamId)
        .sort((left, right) => left.number - right.number),
    [activeGame.data?.homeTeamId, teamPlayers.data],
  );

  const activeGameEvents = useMemo(
    () =>
      activeGameData
        ? playerEvents.data.filter(
            (event) => event.game_id === activeGameData.gameId,
          )
        : [],
    [activeGameData, playerEvents.data],
  );

  const currentHalfForStarting =
    matchStatus === "secondHalf" || matchStatus === "halftime"
      ? "secondHalf"
      : "firstHalf";

  const startingEvents = useMemo(
    () =>
      activeGameEvents.filter(
        (event) =>
          event.eventType === "startingPlayer" &&
          event.half === currentHalfForStarting,
      ),
    [activeGameEvents, currentHalfForStarting],
  );

  const startingPlayerNumbers = useMemo(
    () => startingEvents.map((event) => event.player),
    [startingEvents],
  );

  const firstHalfStartingPlayerNumbers = useMemo(
    () =>
      activeGameEvents
        .filter(
          (event) =>
            event.eventType === "startingPlayer" && event.half === "firstHalf",
        )
        .map((event) => event.player),
    [activeGameEvents],
  );

  const secondHalfStartingPlayerNumbers = useMemo(
    () =>
      activeGameEvents
        .filter(
          (event) =>
            event.eventType === "startingPlayer" && event.half === "secondHalf",
        )
        .map((event) => event.player),
    [activeGameEvents],
  );

  const activePlayerNumbers = useMemo(
    () => getActivePlayers(activeGameEvents),
    [activeGameEvents],
  );

  const teamQuickSubPairs = useMemo(
    () =>
      quickSubPairs.data.filter(
        (pair) => pair.teamId === activeGameData?.homeTeamId,
      ),
    [activeGameData?.homeTeamId, quickSubPairs.data],
  );

  return {
    activeGame,
    activeGameData,
    activeGameRecord,
    activeGameEvents,
    activePlayerNumbers,
    currentHalfForStarting,
    firstHalfStartingPlayerNumbers,
    nextEventId,
    secondHalfStartingPlayerNumbers,
    selectedTeamPlayers,
    startingPlayerNumbers,
    teamPlayers,
    teamQuickSubPairs,
  };
}
