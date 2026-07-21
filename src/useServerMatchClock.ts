import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { DetailedError } from "hono/client";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { gamesCollection, pauseTogglesCollection } from "@/collections";
import type { ActiveGame, Game, MatchHalf, PauseToggle } from "@/datamodel";
import type { MatchStatus } from "@/inGameControlsAtoms";
import {
  beginMatchSaving,
  markMatchFailed,
  markMatchSaved,
} from "@/matchSyncAtom";
import {
  getMatchClockSnapshotQuery,
  setGamePauseStateMutation,
  transitionGamePhaseMutation,
} from "@/server/api/client";
import { useNow } from "@/useNow";

function matchStatusFromGame(game: Game): MatchStatus | null {
  if (game.secondHalfStartedAtMs != null) {
    return "secondHalf";
  }

  if (game.halftimeStartedAtMs != null) {
    return "halftime";
  }

  if (game.firstHalfStartedAtMs != null) {
    return "firstHalf";
  }

  return null;
}

function applyGamePhaseLocally(game: Game) {
  gamesCollection.update(game.id, (draft) => {
    draft.firstHalfStartedAtMs = game.firstHalfStartedAtMs ?? null;
    draft.halftimeStartedAtMs = game.halftimeStartedAtMs ?? null;
    draft.secondHalfStartedAtMs = game.secondHalfStartedAtMs ?? null;
  });
}

function isPhaseConflictError(error: unknown): boolean {
  return error instanceof DetailedError && error.statusCode === 409;
}

interface UseServerMatchClockOptions {
  activeGameData: ActiveGame | null;
  activeGameRecord: Game | null;
  matchStatus: MatchStatus | null;
  setMatchStatus: Dispatch<SetStateAction<MatchStatus | null>>;
}

interface UseServerMatchClockResult {
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isClockMutationPending: boolean;
  activeHalf: "firstHalf" | "secondHalf" | null;
  eventElapsedSeconds: number;
  activeGamePauseToggles: PauseToggle[];
  startFirstHalf: () => void;
  startSecondHalf: () => void;
  startHalftime: () => void;
  togglePause: () => void;
  clearClockState: () => void;
}

function msToS(elapsedMs: number): number {
  return Math.floor(elapsedMs / 1000);
}

function calculateElapsedMs(
  startedAtMs: number | null,
  sortedToggleTimes: number[],
  nowMs: number,
): number {
  if (startedAtMs === null) {
    return 0;
  }

  let completedPausedMs = 0;

  for (let index = 0; index + 1 < sortedToggleTimes.length; index += 2) {
    completedPausedMs +=
      sortedToggleTimes[index + 1] - sortedToggleTimes[index];
  }

  const effectiveNowMs =
    sortedToggleTimes.length % 2 === 1
      ? sortedToggleTimes[sortedToggleTimes.length - 1]
      : nowMs;

  return Math.max(0, effectiveNowMs - startedAtMs - completedPausedMs);
}

function inferActiveHalf(
  firstHalfStartedAtMs: number | null,
  secondHalfStartedAtMs: number | null,
): "firstHalf" | "secondHalf" | null {
  if (secondHalfStartedAtMs !== null) {
    return "secondHalf";
  }

  if (firstHalfStartedAtMs !== null) {
    return "firstHalf";
  }

  return null;
}

async function reloadMatchClockCollections() {
  await Promise.all([
    gamesCollection.utils.refetch(),
    pauseTogglesCollection.utils.refetch(),
  ]);
}

export function useServerMatchClock({
  activeGameData,
  activeGameRecord,
  matchStatus,
  setMatchStatus,
}: UseServerMatchClockOptions): UseServerMatchClockResult {
  const pauseTogglesQuery = useLiveSuspenseQuery((q) =>
    q.from({ pauseToggle: pauseTogglesCollection }),
  );
  const pauseToggles = pauseTogglesQuery.data;

  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [isClockMutationPending, setIsClockMutationPending] = useState(false);
  const clockMutationPendingRef = useRef(false);

  const syncServerOffset = useCallback(async () => {
    if (!activeGameData) {
      return;
    }

    try {
      const requestedAtMs = Date.now();
      const snapshot = await getMatchClockSnapshotQuery(activeGameData.gameId);
      const receivedAtMs = Date.now();
      const clientMidpointMs = Math.floor((requestedAtMs + receivedAtMs) / 2);
      const nextOffsetMs = snapshot.serverNowMs - clientMidpointMs;

      setServerOffsetMs(nextOffsetMs);
    } catch (error) {
      console.error("Failed to sync server match clock offset", error);
    }
  }, [activeGameData]);

  useEffect(() => {
    if (!activeGameData) {
      return;
    }

    void syncServerOffset();
  }, [activeGameData, syncServerOffset]);

  useEffect(() => {
    if (!activeGameData) {
      return;
    }

    const id = setInterval(() => {
      void syncServerOffset();
    }, 30_000);

    return () => clearInterval(id);
  }, [activeGameData, syncServerOffset]);

  // Initialise matchStatus from the game record on load/refresh.
  useEffect(() => {
    if (matchStatus !== null) {
      return;
    }

    if (activeGameRecord?.secondHalfStartedAtMs != null) {
      setMatchStatus("secondHalf");
      return;
    }

    if (activeGameRecord?.halftimeStartedAtMs != null) {
      setMatchStatus("halftime");
      return;
    }

    if (activeGameRecord?.firstHalfStartedAtMs != null) {
      setMatchStatus("firstHalf");
    }
  }, [
    activeGameRecord?.firstHalfStartedAtMs,
    activeGameRecord?.halftimeStartedAtMs,
    activeGameRecord?.secondHalfStartedAtMs,
    matchStatus,
    setMatchStatus,
  ]);

  const firstHalfStartedAtMs = activeGameRecord?.firstHalfStartedAtMs ?? null;
  const halftimeStartedAtMs = activeGameRecord?.halftimeStartedAtMs ?? null;
  const secondHalfStartedAtMs = activeGameRecord?.secondHalfStartedAtMs ?? null;

  const activeHalf = inferActiveHalf(
    firstHalfStartedAtMs,
    secondHalfStartedAtMs,
  );

  const activeGamePauseToggles = useMemo(() => {
    if (!activeGameData) {
      return [];
    }

    return pauseToggles.filter(
      (toggle) => toggle.gameId === activeGameData.gameId,
    );
  }, [activeGameData, pauseToggles]);

  const activeHalfToggleTimes = useMemo(
    () =>
      activeGamePauseToggles
        .filter((toggle) => toggle.half === activeHalf)
        .map((toggle) => toggle.toggledAtMs)
        .sort((left, right) => left - right),
    [activeGamePauseToggles, activeHalf],
  );

  const paused = activeHalfToggleTimes.length % 2 === 1;
  const isHalftime =
    halftimeStartedAtMs !== null && secondHalfStartedAtMs === null;
  const isRunning = activeHalf !== null && !isHalftime && !paused;

  const nowMs = useNow(isRunning, 1000, serverOffsetMs);

  const activeElapsedMs = calculateElapsedMs(
    activeHalf === "firstHalf"
      ? firstHalfStartedAtMs
      : activeHalf === "secondHalf"
        ? secondHalfStartedAtMs
        : null,
    activeHalfToggleTimes,
    nowMs,
  );

  const totalSeconds = msToS(activeElapsedMs);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const beginClockMutation = useCallback(() => {
    if (clockMutationPendingRef.current) {
      return false;
    }

    clockMutationPendingRef.current = true;
    setIsClockMutationPending(true);
    beginMatchSaving();
    return true;
  }, []);

  const endClockMutation = useCallback(() => {
    clockMutationPendingRef.current = false;
    setIsClockMutationPending(false);
  }, []);

  const requestPauseState = useCallback(
    async (half: MatchHalf, paused: boolean) => {
      if (!activeGameData) {
        return { applied: false as const };
      }

      const result = await setGamePauseStateMutation(activeGameData.gameId, {
        half,
        paused,
        clientId: uuidv4(),
      });

      await pauseTogglesCollection.utils.refetch();
      return result;
    },
    [activeGameData],
  );

  const setPaused = useCallback(
    async (half: MatchHalf, nextPaused: boolean) => {
      if (!beginClockMutation()) {
        return { applied: false as const };
      }

      try {
        const result = await requestPauseState(half, nextPaused);
        markMatchSaved();
        return result;
      } catch (error) {
        console.error("Failed to set match pause state", error);
        try {
          await pauseTogglesCollection.utils.refetch();
        } catch (refetchError) {
          console.error("Failed to refresh match pause state", refetchError);
        }
        markMatchFailed(
          "Could not update pause state. Retry, or reload the match.",
          () => {
            void setPaused(half, nextPaused);
          },
        );
        return { applied: false as const };
      } finally {
        endClockMutation();
      }
    },
    [beginClockMutation, endClockMutation, requestPauseState],
  );

  const reconcilePhaseConflict = useCallback(
    async (gameId: number) => {
      await gamesCollection.utils.refetch();
      const refreshed = gamesCollection.get(gameId);
      if (refreshed) {
        setMatchStatus(matchStatusFromGame(refreshed));
      }
    },
    [setMatchStatus],
  );

  const startFirstHalf = useCallback(() => {
    if (!activeGameRecord || !beginClockMutation()) {
      return;
    }

    void (async () => {
      try {
        const { game } = await transitionGamePhaseMutation(
          activeGameRecord.id,
          "firstHalf",
        );
        applyGamePhaseLocally(game);
        setMatchStatus(matchStatusFromGame(game));
        markMatchSaved();
      } catch (error) {
        if (isPhaseConflictError(error)) {
          await reconcilePhaseConflict(activeGameRecord.id);
          markMatchSaved();
          return;
        }
        console.error("Failed to start first half", error);
        try {
          await reloadMatchClockCollections();
        } catch (refetchError) {
          console.error(
            "Failed to reload match after clock error",
            refetchError,
          );
        }
        markMatchFailed(
          "Could not start the first half. Retry, or reload the match.",
          () => {
            startFirstHalf();
          },
        );
      } finally {
        endClockMutation();
      }
    })();
  }, [
    activeGameRecord,
    beginClockMutation,
    endClockMutation,
    reconcilePhaseConflict,
    setMatchStatus,
  ]);

  const startSecondHalf = useCallback(() => {
    if (!activeGameRecord || !beginClockMutation()) {
      return;
    }

    void (async () => {
      try {
        const { game } = await transitionGamePhaseMutation(
          activeGameRecord.id,
          "secondHalf",
        );
        applyGamePhaseLocally(game);
        setMatchStatus(matchStatusFromGame(game));
        markMatchSaved();
      } catch (error) {
        if (isPhaseConflictError(error)) {
          await reconcilePhaseConflict(activeGameRecord.id);
          markMatchSaved();
          return;
        }
        console.error("Failed to start second half", error);
        try {
          await reloadMatchClockCollections();
        } catch (refetchError) {
          console.error(
            "Failed to reload match after clock error",
            refetchError,
          );
        }
        markMatchFailed(
          "Could not start the second half. Retry, or reload the match.",
          () => {
            startSecondHalf();
          },
        );
      } finally {
        endClockMutation();
      }
    })();
  }, [
    activeGameRecord,
    beginClockMutation,
    endClockMutation,
    reconcilePhaseConflict,
    setMatchStatus,
  ]);

  const startHalftime = useCallback(() => {
    if (!activeGameRecord || !beginClockMutation()) {
      return;
    }

    void (async () => {
      try {
        const { game } = await transitionGamePhaseMutation(
          activeGameRecord.id,
          "halftime",
        );
        applyGamePhaseLocally(game);
        // Every successful or idempotent HT transition enforces the desired
        // paused state. The server rejects stale resumes once HT has started.
        await requestPauseState("firstHalf", true);
        setMatchStatus(matchStatusFromGame(game));
        markMatchSaved();
      } catch (error) {
        if (isPhaseConflictError(error)) {
          await reconcilePhaseConflict(activeGameRecord.id);
          markMatchSaved();
          return;
        }
        console.error("Failed to start halftime", error);
        try {
          await reloadMatchClockCollections();
        } catch (refetchError) {
          console.error(
            "Failed to reload match after clock error",
            refetchError,
          );
        }
        markMatchFailed(
          "Could not start halftime. Retry, or reload the match.",
          () => {
            startHalftime();
          },
        );
      } finally {
        endClockMutation();
      }
    })();
  }, [
    activeGameRecord,
    beginClockMutation,
    endClockMutation,
    reconcilePhaseConflict,
    requestPauseState,
    setMatchStatus,
  ]);

  const togglePause = useCallback(() => {
    if (activeHalf === null) {
      return;
    }

    void setPaused(activeHalf, !paused);
  }, [activeHalf, paused, setPaused]);

  const clearClockState = useCallback(() => {
    setMatchStatus(null);
  }, [setMatchStatus]);

  return {
    minutes,
    seconds,
    isRunning,
    isClockMutationPending,
    activeHalf,
    eventElapsedSeconds: totalSeconds,
    activeGamePauseToggles,
    startFirstHalf,
    startSecondHalf,
    startHalftime,
    clearClockState,
    togglePause,
  };
}
