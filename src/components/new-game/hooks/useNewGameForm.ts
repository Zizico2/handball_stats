"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useCallback, useState } from "react";
import { activeGameCollection, gamesCollection } from "@/collections";
import { useNextLocalId } from "@/hooks/useNextLocalId";
import { startGameMutation } from "@/server/api/client";

interface UseNewGameFormParams {
  onStarted: () => void;
  selectedTeamId: number | null;
}

export function useNewGameForm({
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
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const clearStartError = useCallback(() => {
    setStartError(null);
  }, []);

  const handleStartNewGame = useCallback(async () => {
    if (selectedTeamId === null || isStarting) {
      return;
    }

    setIsStarting(true);
    setStartError(null);

    try {
      await startGameMutation({
        id: nextGameId,
        homeTeamId: selectedTeamId,
        createdAt: new Date().toISOString(),
      });

      await Promise.all([
        gamesCollection.utils.refetch(),
        activeGameCollection.utils.refetch(),
      ]);

      onStarted();
    } catch {
      setStartError("Could not start the game. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, nextGameId, onStarted, selectedTeamId]);

  return {
    clearStartError,
    handleStartNewGame,
    isStarting,
    nextGameId,
    startError,
  };
}
