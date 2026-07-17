"use client";

import { useMachine } from "@xstate/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { fromPromise } from "xstate";
import { playerEventsCollection } from "@/collections";
import { ActiveGameEventDialogs } from "@/components/active-game/ActiveGameEventDialogs";
import { ActiveGameView } from "@/components/active-game/ActiveGameView";
import { useActiveGameControls } from "@/components/active-game/hooks/useActiveGameControls";
import { useActiveGameData } from "@/components/active-game/hooks/useActiveGameData";
import {
  awaitPlayerEventDeletionPersistence,
  awaitPlayerEventPersistence,
  insertPlayerEvent,
} from "@/components/active-game/utils/insertPlayerEvent";
import {
  formatUndoEventLabel,
  getLastUndoableEvent,
} from "@/components/active-game/utils/lastUndoableEvent";
import type { EventGroup, PlayerEvent } from "@/datamodel";
import { eventMachine } from "@/event_form_fsm";
import { usePlayerLabelMap } from "@/hooks/usePlayerLabelMap";
import type { MatchStatus } from "@/inGameControlsAtoms";
import {
  beginMatchSaving,
  markMatchFailed,
  markMatchSaved,
  matchSyncAtom,
} from "@/matchSyncAtom";
import type { DeepPartial } from "@/utils";

function ActiveGame() {
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [starting7DialogOpen, setStarting7DialogOpen] = useState(false);
  const [quickSubDialogOpen, setQuickSubDialogOpen] = useState(false);
  const [isSavingStarting7, setIsSavingStarting7] = useState(false);
  const [isSavingQuickSub, setIsSavingQuickSub] = useState(false);
  const [isUndoingLastEvent, setIsUndoingLastEvent] = useState(false);
  const matchSync = useAtomValue(matchSyncAtom);

  const {
    activeGame,
    activeGameData,
    activeGameRecord,
    activeGameEvents,
    activePlayerNumbers,
    currentHalfForStarting,
    firstHalfStartingPlayerNumbers,
    nextEventId,
    secondHalfStartingPlayerNumbers,
    selectedTeamPlayers,
    startingPlayerNumbers,
    teamPlayers,
    teamQuickSubPairs,
  } = useActiveGameData(matchStatus);

  const { activeHalf, eventElapsedSeconds, minutes, seconds } =
    useActiveGameControls({
      activeGameData,
      activeGameRecord,
      firstHalfStartingPlayerNumbers,
      secondHalfStartingPlayerNumbers,
      matchStatus,
      setMatchStatus,
    });

  const { getPlayerLabel } = usePlayerLabelMap(
    teamPlayers.data,
    activeGameData?.homeTeamId,
  );

  const lastUndoableEvent = getLastUndoableEvent(activeGameEvents);
  const undoEventLabel =
    lastUndoableEvent == null
      ? null
      : formatUndoEventLabel(lastUndoableEvent, getPlayerLabel);

  const [state, send] = useMachine(
    eventMachine.provide({
      actors: {
        persistEvent: fromPromise(
          async ({ input }: { input: DeepPartial<PlayerEvent> }) => {
            beginMatchSaving();
            try {
              const tx = insertPlayerEvent(input);
              await awaitPlayerEventPersistence(tx);
              markMatchSaved();
            } catch (error) {
              console.error("Failed to persist player event", error);
              throw error;
            }
          },
        ),
      },
    }),
  );

  useEffect(() => {
    if (!state.matches("persistFailed")) {
      return;
    }

    markMatchFailed("Could not save the event. Please try again.", () => {
      send({ type: "RETRY" });
    });
  }, [state, send]);

  const isPersistingEvent =
    state.matches("finished") || state.matches("persistFailed");

  const handleStartEvent = (eventGroup: EventGroup) => {
    if (!activeGame.data || !activeHalf) {
      return;
    }

    if (matchSync.status === "saving" || isPersistingEvent) {
      return;
    }

    if (eventGroup === "substitution") {
      setQuickSubDialogOpen(true);
      return;
    }

    send({
      type: "START",
      eventGroup,
      ellapsed_seconds: eventElapsedSeconds,
      game_id: activeGame.data.gameId,
      id: nextEventId,
      half: activeHalf,
    });
  };

  const handleSaveStarting7 = useCallback(
    async (numbers: number[]) => {
      if (!activeGameData || isSavingStarting7) {
        return;
      }

      setIsSavingStarting7(true);
      beginMatchSaving();

      try {
        const existingStarting = activeGameEvents.filter(
          (event) =>
            event.eventType === "startingPlayer" &&
            event.half === currentHalfForStarting,
        );

        const deleteTxs = existingStarting.map((event) =>
          playerEventsCollection.delete(event.id),
        );
        const insertTxs = numbers.map((num, index) =>
          insertPlayerEvent({
            id: nextEventId + index,
            player: num,
            game_id: activeGameData.gameId,
            ellapsed_seconds: 0,
            half: currentHalfForStarting,
            eventType: "startingPlayer",
            eventGroup: "substitution",
          }),
        );

        await Promise.all([
          ...deleteTxs.map((tx, index) =>
            awaitPlayerEventDeletionPersistence(tx, existingStarting[index].id),
          ),
          ...insertTxs.map((tx) => awaitPlayerEventPersistence(tx)),
        ]);

        markMatchSaved();
        setStarting7DialogOpen(false);
      } catch (error) {
        console.error("Failed to save starting lineup", error);
        markMatchFailed(
          "Could not save the starting lineup. Please try again.",
          () => {
            void handleSaveStarting7(numbers);
          },
        );
      } finally {
        setIsSavingStarting7(false);
      }
    },
    [
      activeGameData,
      activeGameEvents,
      currentHalfForStarting,
      isSavingStarting7,
      nextEventId,
    ],
  );

  const handleQuickSub = useCallback(
    async (playerOut: number, playerIn: number) => {
      if (
        !activeHalf ||
        activeGame.data == null ||
        isSavingQuickSub ||
        activeGameData == null
      ) {
        return;
      }

      setIsSavingQuickSub(true);
      beginMatchSaving();

      try {
        const tx = insertPlayerEvent({
          id: nextEventId,
          player: playerOut,
          game_id: activeGameData.gameId,
          ellapsed_seconds: eventElapsedSeconds,
          half: activeHalf,
          eventType: "substitution",
          eventGroup: "substitution",
          event: { playerIn },
        });
        await awaitPlayerEventPersistence(tx);
        markMatchSaved();
        setQuickSubDialogOpen(false);
      } catch (error) {
        console.error("Failed to save substitution", error);
        markMatchFailed(
          "Could not save the substitution. Please try again.",
          () => {
            void handleQuickSub(playerOut, playerIn);
          },
        );
      } finally {
        setIsSavingQuickSub(false);
      }
    },
    [
      activeGame.data,
      activeGameData,
      activeHalf,
      eventElapsedSeconds,
      isSavingQuickSub,
      nextEventId,
    ],
  );

  const handlePickManually = () => {
    if (!activeGame.data || !activeHalf) {
      return;
    }

    setQuickSubDialogOpen(false);
    send({
      type: "START",
      eventGroup: "substitution",
      ellapsed_seconds: eventElapsedSeconds,
      game_id: activeGame.data.gameId,
      id: nextEventId,
      half: activeHalf,
    });
  };

  const undoEventById = useCallback(
    async (eventId: number) => {
      if (isUndoingLastEvent || matchSync.status === "saving") {
        return;
      }

      setIsUndoingLastEvent(true);
      beginMatchSaving();

      try {
        if (playerEventsCollection.get(eventId) === undefined) {
          await playerEventsCollection.utils.refetch();
          if (playerEventsCollection.get(eventId) === undefined) {
            markMatchSaved();
            return;
          }
        }

        const tx = playerEventsCollection.delete(eventId);
        await awaitPlayerEventDeletionPersistence(tx, eventId);
        markMatchSaved();
      } catch (error) {
        console.error("Failed to undo last event", error);
        markMatchFailed(
          "Could not undo the last event. Please try again.",
          () => {
            void undoEventById(eventId);
          },
        );
      } finally {
        setIsUndoingLastEvent(false);
      }
    },
    [isUndoingLastEvent, matchSync.status],
  );

  const handleUndoLastEvent = useCallback(() => {
    const event = getLastUndoableEvent(activeGameEvents);
    if (event == null) {
      return;
    }
    void undoEventById(event.id);
  }, [activeGameEvents, undoEventById]);

  const hasUnresolvedMutation =
    matchSync.status === "saving" || matchSync.status === "failed";

  return (
    <>
      <ActiveGameView
        activeGameEvents={activeGameEvents}
        activePlayerNumbers={activePlayerNumbers}
        eventButtonsDisabled={
          !activeGame.data ||
          selectedTeamPlayers.length === 0 ||
          startingPlayerNumbers.length === 0 ||
          !(matchStatus === "firstHalf" || matchStatus === "secondHalf") ||
          hasUnresolvedMutation ||
          isPersistingEvent ||
          isSavingStarting7 ||
          isSavingQuickSub ||
          isUndoingLastEvent
        }
        getPlayerLabel={getPlayerLabel}
        hasActiveGame={activeGameData != null}
        matchClock={{ minutes, seconds }}
        onRecordEvent={handleStartEvent}
        onSetStartingLineup={() => {
          if (activeGameData != null) {
            setStarting7DialogOpen(true);
          }
        }}
        onUndoLastEvent={handleUndoLastEvent}
        selectedTeamPlayers={selectedTeamPlayers}
        startingPlayerNumbers={startingPlayerNumbers}
        undoDisabled={
          lastUndoableEvent == null ||
          hasUnresolvedMutation ||
          isPersistingEvent ||
          isSavingStarting7 ||
          isSavingQuickSub ||
          isUndoingLastEvent
        }
        undoEventLabel={undoEventLabel}
      />
      <ActiveGameEventDialogs
        activeGameGameId={activeGame.data?.gameId ?? null}
        activeHalf={activeHalf}
        activePlayerNumbers={activePlayerNumbers}
        eventElapsedSeconds={eventElapsedSeconds}
        isSavingQuickSub={isSavingQuickSub}
        isSavingStarting7={isSavingStarting7}
        nextEventId={nextEventId}
        quickSubDialogOpen={quickSubDialogOpen}
        quickSubPairs={teamQuickSubPairs}
        selectedTeamPlayers={selectedTeamPlayers}
        send={send}
        starting7DialogOpen={starting7DialogOpen}
        startingPlayerNumbers={startingPlayerNumbers}
        state={state}
        onCloseQuickSub={() => {
          if (!isSavingQuickSub) {
            setQuickSubDialogOpen(false);
          }
        }}
        onCloseStarting7={() => {
          if (!isSavingStarting7) {
            setStarting7DialogOpen(false);
          }
        }}
        onPickManually={handlePickManually}
        onQuickSub={handleQuickSub}
        onSaveStarting7={handleSaveStarting7}
      />
    </>
  );
}

export default ActiveGame;

export { getActivePlayers } from "@/components/active-game/utils/activePlayers";
