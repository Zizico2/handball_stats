"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { activeGameCollection, gamesCollection } from "@/collections";
import type { ActiveGame } from "@/datamodel";
import { useNextLocalId } from "@/hooks/useNextLocalId";

interface UseNewGameFormParams {
  activeGameData: ActiveGame | undefined;
  onStarted: () => void;
  selectedTeamId: number | null;
}

export function useNewGameForm({
  activeGameData,
  onStarted,
  selectedTeamId,
}: UseNewGameFormParams) {
  const lastGame = useLiveSuspenseQuery((q) =>
    q
      .from({ game: gamesCollection })
      .orderBy(({ game }) => game.id, "desc")
      .findOne(),
  );

  const nextGameId = useNextLocalId(lastGame);

  const handleStartNewGame = () => {
    if (selectedTeamId === null) {
      return;
    }

    gamesCollection.insert({
      id: nextGameId,
      homeTeamId: selectedTeamId,
      createdAt: new Date().toISOString(),
      firstHalfStartedAtMs: null,
      secondHalfStartedAtMs: null,
    });

    if (activeGameData) {
      activeGameCollection.delete(activeGameData.id);
    }

    activeGameCollection.insert({
      id: 1,
      gameId: nextGameId,
      homeTeamId: selectedTeamId,
    });

    onStarted();
  };

  return { handleStartNewGame, nextGameId };
}
