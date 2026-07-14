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

  const handleStartNewGame = async () => {
    if (selectedTeamId === null) {
      return;
    }

    // Persist the game before the active-game marker. Both share a FK to
    // (user_id, game_local_id); firing the two collection writes concurrently
    // can make the active-game upsert fail with SQLITE_CONSTRAINT_FOREIGNKEY.
    const gameTx = gamesCollection.insert({
      id: nextGameId,
      homeTeamId: selectedTeamId,
      createdAt: new Date().toISOString(),
      firstHalfStartedAtMs: null,
      secondHalfStartedAtMs: null,
    });
    await gameTx.isPersisted.promise;

    if (activeGameData) {
      const deleteTx = activeGameCollection.delete(activeGameData.id);
      await deleteTx.isPersisted.promise;
    }

    const activeTx = activeGameCollection.insert({
      id: 1,
      gameId: nextGameId,
      homeTeamId: selectedTeamId,
    });
    await activeTx.isPersisted.promise;

    onStarted();
  };

  return { handleStartNewGame, nextGameId };
}
