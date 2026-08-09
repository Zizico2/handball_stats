"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import {
  activeGameCollection,
  gamesCollection,
  playerEventsCollection,
  quickSubPairsCollection,
  teamPlayersCollection,
  teamsCollection,
} from "@/collections";
import { getActivePlayers } from "@/components/active-game/utils/activePlayers";
import { getActiveSuspensions } from "@/components/active-game/utils/activeSuspensions";
import type { MatchStatus } from "@/inGameControlsAtoms";

export function useActiveGameData(matchStatus: MatchStatus | null) {
  const playerEvents = useLiveSuspenseQuery((q) =>
    q.from({ event: playerEventsCollection }),
  );

  const games = useLiveSuspenseQuery((q) => q.from({ game: gamesCollection }));

  const activeGame = useLiveSuspenseQuery((q) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
  );

  const teams = useLiveSuspenseQuery((q) => q.from({ team: teamsCollection }));

  const teamPlayers = useLiveSuspenseQuery((q) =>
    q.from({ player: teamPlayersCollection }),
  );

  const quickSubPairs = useLiveSuspenseQuery((q) =>
    q.from({ pair: quickSubPairsCollection }),
  );

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

  const activeSuspensions = useMemo(
    () => getActiveSuspensions(activeGameEvents),
    [activeGameEvents],
  );

  const teamQuickSubPairs = useMemo(
    () =>
      quickSubPairs.data.filter(
        (pair) => pair.teamId === activeGameData?.homeTeamId,
      ),
    [activeGameData?.homeTeamId, quickSubPairs.data],
  );

  const teamName = useMemo(() => {
    if (activeGameData == null) {
      return null;
    }
    return (
      teams.data.find((team) => team.id === activeGameData.homeTeamId)?.name ??
      null
    );
  }, [activeGameData, teams.data]);

  return {
    activeGame,
    activeGameData,
    activeGameRecord,
    activeGameEvents,
    activePlayerNumbers,
    activeSuspensions,
    currentHalfForStarting,
    firstHalfStartingPlayerNumbers,
    secondHalfStartingPlayerNumbers,
    selectedTeamPlayers,
    startingPlayerNumbers,
    teamName,
    teamPlayers,
    teamQuickSubPairs,
  };
}
