import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { DetailedError } from "hono/client";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { gamesCollection, pauseTogglesCollection } from "@/collections";
import type { ActiveGame, Game, PauseToggle } from "@/datamodel";
import type { MatchStatus } from "@/inGameControlsAtoms";
import {
  getMatchClockSnapshotQuery,
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
  const secondHalfStartedAtMs = activeGameRecord?.secondHalfStartedAtMs ?? null;

  const activeHalf = inferActiveHalf(
    firstHalfStartedAtMs,
    secondHalfStartedAtMs,
  );

  const nowMs = useNow(Boolean(activeGameData), 1000, serverOffsetMs);

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

  const activeElapsedMs = calculateElapsedMs(
    activeHalf === "firstHalf"
      ? firstHalfStartedAtMs
      : activeHalf === "secondHalf"
        ? secondHalfStartedAtMs
        : null,
    activeHalfToggleTimes,
    nowMs,
  );
  const paused = activeHalfToggleTimes.length % 2 === 1;
  const isRunning = activeHalf !== null && !paused;

  const totalSeconds = msToS(activeElapsedMs);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const appendPauseToggle = useCallback(
    (half: "firstHalf" | "secondHalf") => {
      if (!activeGameData) {
        return;
      }

      pauseTogglesCollection.insert({
        id: uuidv4(),
        gameId: activeGameData.gameId,
        half,
        toggledAtMs: Date.now() + serverOffsetMs,
      });
    },
    [activeGameData, serverOffsetMs],
  );

  const startFirstHalf = useCallback(() => {
    if (!activeGameRecord) {
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
      } catch (error) {
        if (isPhaseConflictError(error)) {
          await gamesCollection.utils.refetch();
          const refreshed = gamesCollection.get(activeGameRecord.id);
          if (refreshed) {
            setMatchStatus(matchStatusFromGame(refreshed));
          }
          return;
        }
        console.error("Failed to start first half", error);
      }
    })();
  }, [activeGameRecord, setMatchStatus]);

  const startSecondHalf = useCallback(() => {
    if (!activeGameRecord) {
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
      } catch (error) {
        if (isPhaseConflictError(error)) {
          await gamesCollection.utils.refetch();
          const refreshed = gamesCollection.get(activeGameRecord.id);
          if (refreshed) {
            setMatchStatus(matchStatusFromGame(refreshed));
          }
          return;
        }
        console.error("Failed to start second half", error);
      }
    })();
  }, [activeGameRecord, setMatchStatus]);

  const startHalftime = useCallback(() => {
    if (!activeGameRecord) {
      return;
    }

    const shouldPauseFirstHalf = activeHalf === "firstHalf" && !paused;

    void (async () => {
      try {
        const { game, applied } = await transitionGamePhaseMutation(
          activeGameRecord.id,
          "halftime",
        );
        applyGamePhaseLocally(game);
        // Only the writer that actually applied HT may insert the pause toggle,
        // so concurrent idempotent tabs cannot resume the clock with a second toggle.
        if (applied && shouldPauseFirstHalf) {
          appendPauseToggle("firstHalf");
        }
        setMatchStatus(matchStatusFromGame(game));
      } catch (error) {
        if (isPhaseConflictError(error)) {
          await gamesCollection.utils.refetch();
          const refreshed = gamesCollection.get(activeGameRecord.id);
          if (refreshed) {
            setMatchStatus(matchStatusFromGame(refreshed));
          }
          return;
        }
        console.error("Failed to start halftime", error);
      }
    })();
  }, [activeGameRecord, activeHalf, appendPauseToggle, paused, setMatchStatus]);

  const togglePause = useCallback(() => {
    if (activeHalf === "firstHalf") {
      appendPauseToggle("firstHalf");
      return;
    }

    if (activeHalf === "secondHalf") {
      appendPauseToggle("secondHalf");
    }
  }, [activeHalf, appendPauseToggle]);

  const clearClockState = useCallback(() => {
    setMatchStatus(null);
  }, [setMatchStatus]);

  return {
    minutes,
    seconds,
    isRunning,
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
