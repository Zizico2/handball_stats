"use client";

import { useSetAtom } from "jotai";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { activeGameCollection } from "@/collections";
import type { ActiveGame, Game } from "@/datamodel";
import {
  inGameControlsAtom,
  initialActiveGameControlsState,
  type MatchStatus,
} from "@/inGameControlsAtoms";
import {
  beginMatchSaving,
  markMatchFailed,
  markMatchSaved,
} from "@/matchSyncAtom";
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
  const endMatchPendingRef = useRef(false);

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
    matchStatus,
    setMatchStatus,
  });

  const handleEndMatch = useCallback(() => {
    if (!activeGameData || endMatchPendingRef.current) {
      return;
    }

    endMatchPendingRef.current = true;
    beginMatchSaving();

    void (async () => {
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
      } catch (error) {
        console.error("Failed to end match", error);
        markMatchFailed(
          "Could not end the match. Retry, or reload the match.",
          handleEndMatch,
        );
      } finally {
        endMatchPendingRef.current = false;
      }
    })();
  }, [activeGameData, clearClockState]);

  useEffect(() => {
    setActiveGameControls({
      hasActiveGame: activeGameData !== null,
      matchStatus,
      isRunning,
      isClockMutationPending,
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
    isClockMutationPending,
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
