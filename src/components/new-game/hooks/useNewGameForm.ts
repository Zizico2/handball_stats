"use client";

import { useCallback, useRef, useState } from "react";
import type { ClientId } from "@/datamodel";
import { createClientId } from "@/lib/clientId";
import {
  beginMatchSaving,
  markMatchFailed,
  markMatchSaved,
} from "@/matchSyncAtom";
import { startGameMutation } from "@/server/api/client";
import { useAppCollections } from "@/useAppCollections";

interface UseNewGameFormParams {
  onStarted: () => void;
  rosterReady: boolean;
  selectedTeamId: ClientId | null;
}

export function useNewGameForm({
  onStarted,
  rosterReady,
  selectedTeamId,
}: UseNewGameFormParams) {
  const { activeGameCollection, gamesCollection } = useAppCollections();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pendingGameIdRef = useRef<ClientId | null>(null);

  const clearStartError = useCallback(() => {
    setStartError(null);
    pendingGameIdRef.current = null;
  }, []);

  const handleStartNewGame = useCallback(async () => {
    if (selectedTeamId === null || !rosterReady || isStarting) {
      return;
    }

    setIsStarting(true);
    setStartError(null);
    beginMatchSaving();
    const gameId = pendingGameIdRef.current ?? createClientId();
    pendingGameIdRef.current = gameId;

    try {
      await startGameMutation({
        id: gameId,
        homeTeamId: selectedTeamId,
        createdAt: new Date().toISOString(),
      });

      await Promise.all([
        gamesCollection.utils.refetch(),
        activeGameCollection.utils.refetch(),
      ]);

      markMatchSaved();
      pendingGameIdRef.current = null;
      onStarted();
    } catch (error) {
      try {
        await Promise.all([
          gamesCollection.utils.refetch(),
          activeGameCollection.utils.refetch(),
        ]);
        const reconciledActiveGame = activeGameCollection.get(1);
        if (
          reconciledActiveGame?.gameId === gameId &&
          reconciledActiveGame.homeTeamId === selectedTeamId
        ) {
          markMatchSaved();
          pendingGameIdRef.current = null;
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
  }, [
    activeGameCollection,
    gamesCollection,
    isStarting,
    onStarted,
    rosterReady,
    selectedTeamId,
  ]);

  return {
    clearStartError,
    handleStartNewGame,
    isStarting,
    startError,
  };
}
