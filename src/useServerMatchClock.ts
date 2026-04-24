import { useLiveSuspenseQuery } from "@tanstack/react-db";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pauseTogglesCollection } from "@/collections";
import type { ActiveGame, Game, PauseToggle } from "@/datamodel";
import type { MatchStatus } from "@/inGameControlsAtoms";
import {
  getMatchClockSnapshotQuery,
  upsertGamesMutation,
} from "@/server/api/client";
import { useNow } from "@/useNow";

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
  eventElapsedSeconds: number;
  activeGamePauseToggles: PauseToggle[];
  startFirstHalf: () => void;
  startSecondHalf: () => void;
  startHalftime: () => void;
  togglePause: () => void;
  clearClockState: () => void;
}

function calculateElapsedSeconds(
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

  return Math.floor(
    Math.max(0, effectiveNowMs - startedAtMs - completedPausedMs) / 1000,
  );
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

    const requestedAtMs = Date.now();
    const snapshot = await getMatchClockSnapshotQuery(activeGameData.gameId);
    const receivedAtMs = Date.now();
    const clientMidpointMs = Math.floor((requestedAtMs + receivedAtMs) / 2);
    const nextOffsetMs = snapshot.serverNowMs - clientMidpointMs;

    setServerOffsetMs(nextOffsetMs);
  }, [activeGameData]);

  useEffect(() => {
    if (!activeGameData) {
      return;
    }

    void syncServerOffset();

    // Re-anchor client ticking to the server clock regularly.
    const intervalId = window.setInterval(() => {
      void syncServerOffset();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeGameData, syncServerOffset]);

  const [localHalfStarts, setLocalHalfStarts] = useState<{
    firstHalfStartedAtMs: number | null;
    secondHalfStartedAtMs: number | null;
  }>({
    firstHalfStartedAtMs: null,
    secondHalfStartedAtMs: null,
  });

  useEffect(() => {
    setLocalHalfStarts({
      firstHalfStartedAtMs: activeGameRecord?.firstHalfStartedAtMs ?? null,
      secondHalfStartedAtMs: activeGameRecord?.secondHalfStartedAtMs ?? null,
    });
  }, [
    activeGameRecord?.firstHalfStartedAtMs,
    activeGameRecord?.secondHalfStartedAtMs,
  ]);

  useEffect(() => {
    if (matchStatus !== null) {
      return;
    }

    if (localHalfStarts.secondHalfStartedAtMs !== null) {
      setMatchStatus("secondHalf");
      return;
    }

    if (localHalfStarts.firstHalfStartedAtMs !== null) {
      setMatchStatus("firstHalf");
    }
  }, [
    localHalfStarts.firstHalfStartedAtMs,
    localHalfStarts.secondHalfStartedAtMs,
    matchStatus,
    setMatchStatus,
  ]);

  const nowMs = useNow(Boolean(activeGameData), 1000, serverOffsetMs);
  const getCorrectedNowMs = useCallback(
    () => Date.now() + serverOffsetMs,
    [serverOffsetMs],
  );

  const activeGamePauseToggles = useMemo(() => {
    if (!activeGameData) {
      return [];
    }

    return pauseToggles.filter(
      (toggle) => toggle.gameId === activeGameData.gameId,
    );
  }, [activeGameData, pauseToggles]);

  const firstHalfToggleTimes = useMemo(
    () =>
      activeGamePauseToggles
        .filter((toggle) => toggle.half === "firstHalf")
        .map((toggle) => toggle.toggledAtMs)
        .sort((left, right) => left - right),
    [activeGamePauseToggles],
  );

  const secondHalfToggleTimes = useMemo(
    () =>
      activeGamePauseToggles
        .filter((toggle) => toggle.half === "secondHalf")
        .map((toggle) => toggle.toggledAtMs)
        .sort((left, right) => left - right),
    [activeGamePauseToggles],
  );

  const firstHalfElapsedSeconds = calculateElapsedSeconds(
    localHalfStarts.firstHalfStartedAtMs,
    firstHalfToggleTimes,
    nowMs,
  );

  const secondHalfElapsedSeconds = calculateElapsedSeconds(
    localHalfStarts.secondHalfStartedAtMs,
    secondHalfToggleTimes,
    nowMs,
  );

  const firstHalfPaused = firstHalfToggleTimes.length % 2 === 1;
  const secondHalfPaused = secondHalfToggleTimes.length % 2 === 1;

  const isRunning =
    matchStatus === "firstHalf"
      ? localHalfStarts.firstHalfStartedAtMs !== null && !firstHalfPaused
      : matchStatus === "secondHalf"
        ? localHalfStarts.secondHalfStartedAtMs !== null && !secondHalfPaused
        : false;

  const displayedSeconds =
    matchStatus === "secondHalf"
      ? secondHalfElapsedSeconds
      : firstHalfElapsedSeconds;

  const [stableDisplayedSeconds, setStableDisplayedSeconds] = useState(0);
  const displayClockKey = `${activeGameData?.gameId ?? "none"}:${
    matchStatus === "secondHalf" ? "secondHalf" : "firstHalf"
  }`;
  const previousDisplayClockKeyRef = useRef(displayClockKey);

  useEffect(() => {
    setStableDisplayedSeconds((previous) => {
      if (previousDisplayClockKeyRef.current !== displayClockKey) {
        // New game or switched displayed half: reset baseline.
        previousDisplayClockKeyRef.current = displayClockKey;
        return displayedSeconds;
      }

      // Never go backward inside the same displayed clock timeline.
      return displayedSeconds >= previous ? displayedSeconds : previous;
    });
  }, [displayClockKey, displayedSeconds]);

  const eventElapsedSeconds =
    matchStatus === "secondHalf"
      ? secondHalfElapsedSeconds
      : firstHalfElapsedSeconds;

  const nextPauseToggleIdRef = useRef(1);

  useEffect(() => {
    const nextPauseToggleId =
      pauseToggles.reduce(
        (currentMax, pauseToggle) => Math.max(currentMax, pauseToggle.id),
        0,
      ) + 1;

    if (nextPauseToggleIdRef.current < nextPauseToggleId) {
      nextPauseToggleIdRef.current = nextPauseToggleId;
    }
  }, [pauseToggles]);

  const persistHalfStarts = useCallback(
    async (
      firstHalfStartedAtMs: number | null,
      secondHalfStartedAtMs: number | null,
    ) => {
      if (!activeGameRecord) {
        return;
      }

      const updatedGame: Game = {
        ...activeGameRecord,
        firstHalfStartedAtMs,
        secondHalfStartedAtMs,
      };

      setLocalHalfStarts({ firstHalfStartedAtMs, secondHalfStartedAtMs });
      await upsertGamesMutation([updatedGame]);
    },
    [activeGameRecord],
  );

  const appendPauseToggle = useCallback(
    (half: "firstHalf" | "secondHalf") => {
      if (!activeGameData) {
        return;
      }

      pauseTogglesCollection.insert({
        id: nextPauseToggleIdRef.current,
        gameId: activeGameData.gameId,
        half,
        toggledAtMs: getCorrectedNowMs(),
      });

      nextPauseToggleIdRef.current += 1;
    },
    [activeGameData, getCorrectedNowMs],
  );

  const startFirstHalf = useCallback(() => {
    const now = getCorrectedNowMs();
    void persistHalfStarts(
      localHalfStarts.firstHalfStartedAtMs ?? now,
      localHalfStarts.secondHalfStartedAtMs,
    );
    setMatchStatus("firstHalf");
  }, [
    localHalfStarts.firstHalfStartedAtMs,
    localHalfStarts.secondHalfStartedAtMs,
    getCorrectedNowMs,
    persistHalfStarts,
    setMatchStatus,
  ]);

  const startSecondHalf = useCallback(() => {
    const now = getCorrectedNowMs();
    void persistHalfStarts(
      localHalfStarts.firstHalfStartedAtMs,
      localHalfStarts.secondHalfStartedAtMs ?? now,
    );
    setMatchStatus("secondHalf");
  }, [
    localHalfStarts.firstHalfStartedAtMs,
    localHalfStarts.secondHalfStartedAtMs,
    getCorrectedNowMs,
    persistHalfStarts,
    setMatchStatus,
  ]);

  const startHalftime = useCallback(() => {
    if (matchStatus === "firstHalf" && !firstHalfPaused) {
      appendPauseToggle("firstHalf");
    }
    setMatchStatus("halftime");
  }, [appendPauseToggle, firstHalfPaused, matchStatus, setMatchStatus]);

  const togglePause = useCallback(() => {
    if (matchStatus === "firstHalf") {
      appendPauseToggle("firstHalf");
      return;
    }

    if (matchStatus === "secondHalf") {
      appendPauseToggle("secondHalf");
    }
  }, [appendPauseToggle, matchStatus]);

  const clearClockState = useCallback(() => {
    setLocalHalfStarts({
      firstHalfStartedAtMs: null,
      secondHalfStartedAtMs: null,
    });
    setMatchStatus(null);
  }, [setMatchStatus]);

  return {
    minutes: Math.floor(stableDisplayedSeconds / 60),
    seconds: stableDisplayedSeconds % 60,
    isRunning,
    eventElapsedSeconds,
    activeGamePauseToggles,
    startFirstHalf,
    startSecondHalf,
    startHalftime,
    clearClockState,
    togglePause,
  };
}
