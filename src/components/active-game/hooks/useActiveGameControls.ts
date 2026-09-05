"use client";

import { useSetAtom } from "jotai";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { ActiveGame, Game } from "@/datamodel";
import {
  inGameControlsAtom,
  initialActiveGameControlsState,
  type MatchStatus,
  resolvePrimaryClockAction,
} from "@/inGameControlsAtoms";
import {
  beginMatchSaving,
  markMatchFailed,
  markMatchSaved,
} from "@/matchSyncAtom";
import { useAppCollections } from "@/useAppCollections";
import { useServerMatchClock } from "@/useServerMatchClock";

interface UseActiveGameControlsParams {
  activeGameData: ActiveGame | null;
  activeGameRecord: Game | null;
  eventCount: number;
  firstHalfStartingPlayerNumbers: number[];
  goals: number;
  secondHalfStartingPlayerNumbers: number[];
  matchStatus: MatchStatus | null;
  setMatchStatus: Dispatch<SetStateAction<MatchStatus | null>>;
  teamName: string | null;
  initialNowMs: number;
}

export function useActiveGameControls({
  activeGameData,
  activeGameRecord,
  eventCount,
  firstHalfStartingPlayerNumbers,
  goals,
  secondHalfStartingPlayerNumbers,
  matchStatus,
  setMatchStatus,
  teamName,
  initialNowMs,
}: UseActiveGameControlsParams) {
  const setActiveGameControls = useSetAtom(inGameControlsAtom);
  const endMatchPendingRef = useRef(false);
  const { activeGameCollection } = useAppCollections();

  const {
    activeHalf,
    clearClockState,
    eventElapsedSeconds,
    isClockMutationPending,
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
    initialNowMs,
    matchStatus,
    setMatchStatus,
  });

  const handleEndMatch = useCallback(async () => {
    if (!activeGameData || endMatchPendingRef.current) {
      return false;
    }

    endMatchPendingRef.current = true;
    beginMatchSaving();

    try {
      const transaction = activeGameCollection.delete(activeGameData.id);
      try {
        await transaction.isPersisted.promise;
      } catch (error) {
        await activeGameCollection.utils.refetch();
        if (activeGameCollection.get(activeGameData.id) !== undefined) {
          throw error;
        }
      }

      clearClockState();
      markMatchSaved();
      return true;
    } catch (error) {
      console.error("Failed to end match", error);
      markMatchFailed(
        "Could not end the match. Retry, or reload the match.",
        () => {
          void handleEndMatch();
        },
      );
      return false;
    } finally {
      endMatchPendingRef.current = false;
    }
  }, [activeGameCollection, activeGameData, clearClockState]);

  useEffect(() => {
    const disableStartFirstHalf = firstHalfStartingPlayerNumbers.length === 0;
    const disableStartSecondHalf = secondHalfStartingPlayerNumbers.length === 0;
    const primary = resolvePrimaryClockAction({
      hasActiveGame: activeGameData !== null,
      matchStatus,
      isRunning,
      isClockMutationPending,
      disableStartFirstHalf,
      disableStartSecondHalf,
    });

    setActiveGameControls({
      hasActiveGame: activeGameData !== null,
      matchStatus,
      isRunning,
      isClockMutationPending,
      disableStartFirstHalf,
      disableStartSecondHalf,
      teamName,
      gameId: activeGameData?.gameId ?? null,
      clockMinutes: minutes,
      clockSeconds: seconds,
      goals,
      eventCount,
      primaryClockAction: primary.action,
      primaryClockActionLabel: primary.label,
      primaryClockActionDisabled: primary.disabled,
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
    eventCount,
    goals,
    handleEndMatch,
    isClockMutationPending,
    isRunning,
    matchStatus,
    minutes,
    firstHalfStartingPlayerNumbers.length,
    secondHalfStartingPlayerNumbers.length,
    seconds,
    setActiveGameControls,
    startFirstHalf,
    startHalftime,
    startSecondHalf,
    teamName,
    togglePause,
  ]);

  return {
    activeHalf,
    eventElapsedSeconds,
    handleEndMatch,
    isRunning,
    minutes,
    seconds,
  };
}
