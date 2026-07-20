"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useCallback, useState } from "react";
import { activeGameCollection, gamesCollection } from "@/collections";
import { useNextLocalId } from "@/hooks/useNextLocalId";
import {
  beginMatchSaving,
  markMatchFailed,
  markMatchSaved,
} from "@/matchSyncAtom";
import { startGameMutation } from "@/server/api/client";

interface UseNewGameFormParams {
  onStarted: () => void;
  rosterReady: boolean;
  selectedTeamId: number | null;
}

export function useNewGameForm({
  onStarted,
  rosterReady,
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
    if (selectedTeamId === null || !rosterReady || isStarting) {
      return;
    }

    setIsStarting(true);
    setStartError(null);
    beginMatchSaving();

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

      markMatchSaved();
      onStarted();
    } catch (error) {
      try {
        await Promise.all([
          gamesCollection.utils.refetch(),
          activeGameCollection.utils.refetch(),
        ]);
        const reconciledActiveGame = activeGameCollection.get(1);
        if (
          reconciledActiveGame?.gameId === nextGameId &&
          reconciledActiveGame.homeTeamId === selectedTeamId
        ) {
          markMatchSaved();
          onStarted();
          return;
        }
      } catch (reconcileError) {
        console.error("Failed to reconcile game start", reconcileError);
      }

      console.error("Failed to start game", error);
      const message = "Could not start the game. Retry, or reload this page.";
      setStartError(message);
      markMatchFailed(message, () => {
        void handleStartNewGame();
      });
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, nextGameId, onStarted, rosterReady, selectedTeamId]);

  return {
    clearStartError,
    handleStartNewGame,
    isStarting,
    nextGameId,
    startError,
  };
}
