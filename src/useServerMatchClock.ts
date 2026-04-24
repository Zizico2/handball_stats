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
import { upsertGamesMutation } from "@/server/api/client";
import { useNow } from "@/useNow";

interface UseServerMatchClockOptions {
  activeGameData: ActiveGame | null;
  activeGameRecord: Game | null;
  pauseToggles: PauseToggle[];
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
  pauseToggles,
  matchStatus,
  setMatchStatus,
}: UseServerMatchClockOptions): UseServerMatchClockResult {
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

  const nowMs = useNow(Boolean(activeGameData));

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
        toggledAtMs: Date.now(),
      });

      nextPauseToggleIdRef.current += 1;
    },
    [activeGameData],
  );

  const startFirstHalf = useCallback(() => {
    const now = Date.now();
    void persistHalfStarts(
      localHalfStarts.firstHalfStartedAtMs ?? now,
      localHalfStarts.secondHalfStartedAtMs,
    );
    setMatchStatus("firstHalf");
  }, [
    localHalfStarts.firstHalfStartedAtMs,
    localHalfStarts.secondHalfStartedAtMs,
    persistHalfStarts,
    setMatchStatus,
  ]);

  const startSecondHalf = useCallback(() => {
    const now = Date.now();
    void persistHalfStarts(
      localHalfStarts.firstHalfStartedAtMs,
      localHalfStarts.secondHalfStartedAtMs ?? now,
    );
    setMatchStatus("secondHalf");
  }, [
    localHalfStarts.firstHalfStartedAtMs,
    localHalfStarts.secondHalfStartedAtMs,
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
    minutes: Math.floor(displayedSeconds / 60),
    seconds: displayedSeconds % 60,
    isRunning,
    eventElapsedSeconds,
    activeGamePauseToggles,
    startFirstHalf,
    startSecondHalf,
    startHalftime,
    togglePause,
    clearClockState,
  };
}
