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
import { useStopwatch } from "react-timer-hook";
import { gamesCollection, pauseTogglesCollection } from "@/collections";
import type { ActiveGame, Game, PauseToggle } from "@/datamodel";
import type { MatchStatus } from "@/inGameControlsAtoms";
import { getMatchClockSnapshotQuery } from "@/server/api/client";
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

  // TODO: how exactly does this work?
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

  // TODO: I don't love that we have to duplicate the server-derived half start times in local state
  // TODO: Tanstack DB should provide some facilities for this kind of "derive local state from server data" pattern that we have to implement manually here.
  // TODO: maybe there's a derived collection or something. or maybe a query collection can be repurposed for this.

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

  const activeHalf = useMemo(
    () =>
      inferActiveHalf(
        localHalfStarts.firstHalfStartedAtMs,
        localHalfStarts.secondHalfStartedAtMs,
      ),
    [
      localHalfStarts.firstHalfStartedAtMs,
      localHalfStarts.secondHalfStartedAtMs,
    ],
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

  const activeElapsedMs = calculateElapsedMs(
    activeHalf === "firstHalf"
      ? localHalfStarts.firstHalfStartedAtMs
      : activeHalf === "secondHalf"
        ? localHalfStarts.secondHalfStartedAtMs
        : null,
    activeHalfToggleTimes,
    nowMs,
  );
  const activeElapsedSeconds = msToS(activeElapsedMs);
  const paused = activeHalfToggleTimes.length % 2 === 1;

  const isRunning = activeHalf !== null && !paused;

  const stopwatch = useStopwatch({
    autoStart: false,
    offsetTimestamp: new Date(),
    interval: 1000,
  });
  const {
    minutes,
    pause,
    reset,
    seconds,
    start,
    totalMilliseconds,
    totalSeconds,
  } = stopwatch;

  const displayClockKey = `${activeGameData?.gameId ?? "none"}:${
    activeHalf ?? "firstHalf"
  }`;
  const previousDisplayClockKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const isKeyChanged = previousDisplayClockKeyRef.current !== displayClockKey;
    const needsInitialHydration =
      totalMilliseconds === 0 && activeElapsedMs > 0;

    if (!isKeyChanged && !needsInitialHydration) {
      return;
    }

    previousDisplayClockKeyRef.current = displayClockKey;

    // TODO; should there be some "clear" utility?
    if (isKeyChanged) {
      pendingCorrectionMsRef.current = 0;
      lastStopwatchResyncSecondRef.current = -1;
      lastCorrectionSecondRef.current = -1;
    }

    reset(new Date(Date.now() + activeElapsedMs), isRunning);
  }, [displayClockKey, activeElapsedMs, isRunning, reset, totalMilliseconds]);

  const previousRunningRef = useRef(isRunning);

  useEffect(() => {
    if (previousRunningRef.current === isRunning) {
      return;
    }

    previousRunningRef.current = isRunning;

    if (isRunning) {
      start();
      return;
    }

    pause();
    // Freeze exactly on server-derived elapsed when pausing.
    reset(new Date(Date.now() + activeElapsedMs), false);
  }, [activeElapsedMs, isRunning, pause, reset, start]);

  const pendingCorrectionMsRef = useRef(0);
  const lastStopwatchResyncSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      !isRunning ||
      activeElapsedSeconds <= 0 ||
      activeElapsedSeconds % 5 !== 0
    ) {
      return;
    }

    if (lastStopwatchResyncSecondRef.current === activeElapsedSeconds) {
      return;
    }

    lastStopwatchResyncSecondRef.current = activeElapsedSeconds;
    const driftMs = activeElapsedMs - totalMilliseconds;

    // Ignore tiny discrepancies and smooth larger corrections over time.
    if (Math.abs(driftMs) >= 120) {
      const accumulated = pendingCorrectionMsRef.current + driftMs;
      pendingCorrectionMsRef.current = Math.max(
        -3000,
        Math.min(3000, accumulated),
      );
    }

    void syncServerOffset();
  }, [
    activeElapsedMs,
    activeElapsedSeconds,
    isRunning,
    syncServerOffset,
    totalMilliseconds,
  ]);

  const lastCorrectionSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    if (pendingCorrectionMsRef.current === 0) {
      return;
    }

    if (lastCorrectionSecondRef.current === totalSeconds) {
      return;
    }

    lastCorrectionSecondRef.current = totalSeconds;

    const maxStepPerSecondMs = 150;
    const stepMs =
      pendingCorrectionMsRef.current > 0
        ? Math.min(maxStepPerSecondMs, pendingCorrectionMsRef.current)
        : Math.max(-maxStepPerSecondMs, pendingCorrectionMsRef.current);

    pendingCorrectionMsRef.current -= stepMs;

    const adjustedElapsedMs = Math.max(0, totalMilliseconds + stepMs);
    const secondFloorMs = totalSeconds * 1000;
    const secondCeilMs = secondFloorMs + 999;

    // Never let correction cross second boundaries; carry leftovers to next tick.
    const boundedAdjustedElapsedMs = Math.max(
      secondFloorMs,
      Math.min(secondCeilMs, adjustedElapsedMs),
    );

    if (boundedAdjustedElapsedMs === totalMilliseconds) {
      return;
    }

    reset(new Date(Date.now() + boundedAdjustedElapsedMs), true);
  }, [isRunning, reset, totalMilliseconds, totalSeconds]);

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

      // TODO(test): make this `update` fail on purpose to test that the UI stays consistent.
      gamesCollection.update(activeGameRecord.id, (draft) => {
        draft.firstHalfStartedAtMs = firstHalfStartedAtMs;
        draft.secondHalfStartedAtMs = secondHalfStartedAtMs;
      });

      setLocalHalfStarts({ firstHalfStartedAtMs, secondHalfStartedAtMs });
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
    if (activeHalf === "firstHalf" && !paused) {
      appendPauseToggle("firstHalf");
    }
    setMatchStatus("halftime");
  }, [activeHalf, appendPauseToggle, paused, setMatchStatus]);

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
    reset(new Date(), false);
    setLocalHalfStarts({
      firstHalfStartedAtMs: null,
      secondHalfStartedAtMs: null,
    });
    setMatchStatus(null);
  }, [reset, setMatchStatus]);

  return {
    minutes,
    seconds,
    isRunning,
    eventElapsedSeconds: totalSeconds,
    activeGamePauseToggles,
    startFirstHalf,
    startSecondHalf,
    startHalftime,
    clearClockState,
    togglePause,
  };
}
