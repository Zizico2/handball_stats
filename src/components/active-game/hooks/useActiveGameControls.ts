"use client";

import { useSetAtom } from "jotai";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
} from "react";
import { activeGameCollection } from "@/collections";
import type { ActiveGame, Game } from "@/datamodel";
import {
  inGameControlsAtom,
  initialActiveGameControlsState,
  type MatchStatus,
} from "@/inGameControlsAtoms";
import { useServerMatchClock } from "@/useServerMatchClock";

interface UseActiveGameControlsParams {
  activeGameData: ActiveGame | null;
  activeGameRecord: Game | null;
  firstHalfStartingPlayerNumbers: number[];
  secondHalfStartingPlayerNumbers: number[];
  matchStatus: MatchStatus | null;
  setMatchStatus: Dispatch<SetStateAction<MatchStatus | null>>;
}

export function useActiveGameControls({
  activeGameData,
  activeGameRecord,
  firstHalfStartingPlayerNumbers,
  secondHalfStartingPlayerNumbers,
  matchStatus,
  setMatchStatus,
}: UseActiveGameControlsParams) {
  const setActiveGameControls = useSetAtom(inGameControlsAtom);

  const {
    activeHalf,
    clearClockState,
    eventElapsedSeconds,
    isRunning,
    minutes,
    seconds,
    startFirstHalf,
    startHalftime,
    startSecondHalf,
    togglePause,
  } = useServerMatchClock({
    activeGameData,
    activeGameRecord,
    matchStatus,
    setMatchStatus,
  });

  const handleEndMatch = useCallback(() => {
    if (!activeGameData) {
      return;
    }

    activeGameCollection.delete(activeGameData.id);
    clearClockState();
  }, [activeGameData, clearClockState]);

  useEffect(() => {
    setActiveGameControls({
      hasActiveGame: activeGameData !== null,
      matchStatus,
      isRunning,
      disableStartFirstHalf: firstHalfStartingPlayerNumbers.length === 0,
      disableStartSecondHalf: secondHalfStartingPlayerNumbers.length === 0,
      onEndMatch: handleEndMatch,
      onStartFirstHalf: startFirstHalf,
      onStartSecondHalf: startSecondHalf,
      onStartHalftime: startHalftime,
      onTogglePause: togglePause,
    });

    return () => {
      setActiveGameControls(initialActiveGameControlsState);
    };
  }, [
    activeGameData,
    handleEndMatch,
    isRunning,
    matchStatus,
    firstHalfStartingPlayerNumbers.length,
    secondHalfStartingPlayerNumbers.length,
    setActiveGameControls,
    startFirstHalf,
    startHalftime,
    startSecondHalf,
    togglePause,
  ]);

  return {
    activeHalf,
    eventElapsedSeconds,
    handleEndMatch,
    minutes,
    seconds,
  };
}
