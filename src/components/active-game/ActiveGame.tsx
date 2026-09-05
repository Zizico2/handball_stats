"use client";

import { useMachine } from "@xstate/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { fromPromise } from "xstate";
import { ActiveGameEventDialogs } from "@/components/active-game/ActiveGameEventDialogs";
import { ActiveGameView } from "@/components/active-game/ActiveGameView";
import { SuspensionWarningDialog } from "@/components/active-game/dialogs/SuspensionWarningDialog";
import { useActiveGameControls } from "@/components/active-game/hooks/useActiveGameControls";
import { useActiveGameData } from "@/components/active-game/hooks/useActiveGameData";
import type { ActiveSuspension } from "@/components/active-game/utils/activeSuspensions";
import {
  awaitPlayerEventDeletionPersistence,
  awaitPlayerEventPersistence,
  insertPlayerEvent,
} from "@/components/active-game/utils/insertPlayerEvent";
import {
  formatUndoEventLabel,
  getLastUndoableEvent,
} from "@/components/active-game/utils/lastUndoableEvent";
import type { ClientId, EventGroup, PlayerEvent } from "@/datamodel";
import { eventMachine } from "@/event_form_fsm";
import { usePlayerLabelMap } from "@/hooks/usePlayerLabelMap";
import type { MatchStatus } from "@/inGameControlsAtoms";
import { createClientId } from "@/lib/clientId";
import { countGoals } from "@/lib/display/countGoals";
import {
  beginMatchSaving,
  markMatchFailed,
  markMatchSaved,
  matchSyncAtom,
} from "@/matchSyncAtom";
import { useAppCollections } from "@/useAppCollections";
import type { DeepPartial } from "@/utils";

interface PendingExternalSuspensionAction {
  allowEnd: boolean;
  label: string;
  onCancel: () => void;
  onContinue: () => void;
  suspensions: ActiveSuspension[];
}

function ActiveGame({ initialNowMs }: { initialNowMs: number }) {
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [starting7DialogOpen, setStarting7DialogOpen] = useState(false);
  const [quickSubDialogOpen, setQuickSubDialogOpen] = useState(false);
  const [isSavingStarting7, setIsSavingStarting7] = useState(false);
  const [isSavingQuickSub, setIsSavingQuickSub] = useState(false);
  const [isUndoingLastEvent, setIsUndoingLastEvent] = useState(false);
  const [pendingExternalSuspensionAction, setPendingExternalSuspensionAction] =
    useState<PendingExternalSuspensionAction | null>(null);
  const [endingExternalSuspensionId, setEndingExternalSuspensionId] = useState<
    string | null
  >(null);
  const matchSync = useAtomValue(matchSyncAtom);
  const collections = useAppCollections();

  const {
    activeGame,
    activeGameData,
    activeGameRecord,
    activeGameEvents,
    activePlayerNumbers,
    activeSuspensions,
    currentHalfForStarting,
    firstHalfStartingPlayerNumbers,
    secondHalfStartingPlayerNumbers,
    selectedTeamPlayers,
    startingPlayerNumbers,
    teamName,
    teamPlayers,
    teamQuickSubPairs,
  } = useActiveGameData(matchStatus);

  const { activeHalf, eventElapsedSeconds, minutes, seconds } =
    useActiveGameControls({
      activeGameData,
      activeGameRecord,
      eventCount: activeGameEvents.length,
      firstHalfStartingPlayerNumbers,
      goals: countGoals(activeGameEvents),
      secondHalfStartingPlayerNumbers,
      matchStatus,
      setMatchStatus,
      teamName,
      initialNowMs,
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
              const tx = insertPlayerEvent(collections, input);
              await awaitPlayerEventPersistence(collections, tx);
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

  const endSuspensionAndContinue = useCallback(
    async (suspension: ActiveSuspension) => {
      if (!activeGameData || !activeHalf) {
        return false;
      }

      beginMatchSaving();
      try {
        const tx = insertPlayerEvent(collections, {
          id: createClientId(),
          player: suspension.offender,
          game_id: activeGameData.gameId,
          ellapsed_seconds: eventElapsedSeconds,
          half: activeHalf,
          eventType: "twoMinuteSuspensionEnded",
          eventGroup: "sanction",
          event: { suspensionId: suspension.id },
        });
        await awaitPlayerEventPersistence(collections, tx);
        markMatchSaved();
        return true;
      } catch (error) {
        console.error("Failed to end suspension", error);
        markMatchFailed(
          "Could not end the suspension. Retry, or reload the match.",
          () => {
            void endSuspensionAndContinue(suspension);
          },
        );
        return false;
      }
    },
    [activeGameData, activeHalf, collections, eventElapsedSeconds],
  );

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
      id: createClientId(),
      half: activeHalf,
    });
  };

  const handleSaveStarting7 = useCallback(
    async (
      numbers: number[],
      eventIds: ClientId[] = numbers.map(() => createClientId()),
    ) => {
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
          collections.playerEventsCollection.delete(event.id),
        );
        const insertTxs = numbers.map((num, index) =>
          insertPlayerEvent(collections, {
            id: eventIds[index],
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
            awaitPlayerEventDeletionPersistence(
              collections,
              tx,
              existingStarting[index].id,
            ),
          ),
          ...insertTxs.map((tx) =>
            awaitPlayerEventPersistence(collections, tx),
          ),
        ]);

        markMatchSaved();
        setStarting7DialogOpen(false);
      } catch (error) {
        console.error("Failed to save starting lineup", error);
        markMatchFailed(
          "Could not save the starting lineup. Please try again.",
          () => {
            void handleSaveStarting7(numbers, eventIds);
          },
        );
      } finally {
        setIsSavingStarting7(false);
      }
    },
    [
      activeGameData,
      activeGameEvents,
      collections,
      currentHalfForStarting,
      isSavingStarting7,
    ],
  );

  const handleQuickSub = useCallback(
    async (
      playerOut: number,
      playerIn: number,
      eventId: ClientId = createClientId(),
    ) => {
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
        const tx = insertPlayerEvent(collections, {
          id: eventId,
          player: playerOut,
          game_id: activeGameData.gameId,
          ellapsed_seconds: eventElapsedSeconds,
          half: activeHalf,
          eventType: "substitution",
          eventGroup: "substitution",
          event: { playerIn },
        });
        await awaitPlayerEventPersistence(collections, tx);
        markMatchSaved();
        setQuickSubDialogOpen(false);
      } catch (error) {
        console.error("Failed to save substitution", error);
        markMatchFailed(
          "Could not save the substitution. Please try again.",
          () => {
            void handleQuickSub(playerOut, playerIn, eventId);
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
      collections,
    ],
  );

  const handleQuickSubAttempt = useCallback(
    (playerOut: number, playerIn: number) => {
      const suspensions = activeSuspensions.filter(
        (suspension) =>
          suspension.offender === playerIn || suspension.servedBy === playerIn,
      );
      if (suspensions.length > 0) {
        setPendingExternalSuspensionAction({
          allowEnd: activeHalf !== null,
          label: getPlayerLabel(playerIn),
          onCancel: () => setQuickSubDialogOpen(false),
          onContinue: () => {
            void handleQuickSub(playerOut, playerIn);
          },
          suspensions,
        });
        return;
      }
      void handleQuickSub(playerOut, playerIn);
    },
    [activeHalf, activeSuspensions, getPlayerLabel, handleQuickSub],
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
      id: createClientId(),
      half: activeHalf,
    });
  };

  const handleStarting7Attempt = useCallback(
    (numbers: number[]) => {
      const suspensions = activeSuspensions.filter(
        (suspension) =>
          numbers.includes(suspension.offender) ||
          numbers.includes(suspension.servedBy),
      );
      if (suspensions.length > 0) {
        setPendingExternalSuspensionAction({
          allowEnd: activeHalf !== null,
          label: "One of the selected starting players",
          onCancel: () => setStarting7DialogOpen(false),
          onContinue: () => {
            void handleSaveStarting7(numbers);
          },
          suspensions,
        });
        return;
      }
      void handleSaveStarting7(numbers);
    },
    [activeHalf, activeSuspensions, handleSaveStarting7],
  );

  const handleEndExternalSuspensionAndContinue = useCallback(
    async (suspension: ActiveSuspension) => {
      if (
        !pendingExternalSuspensionAction ||
        endingExternalSuspensionId !== null
      ) {
        return;
      }
      setEndingExternalSuspensionId(suspension.id);
      const ended = await endSuspensionAndContinue(suspension);
      setEndingExternalSuspensionId(null);
      if (ended) {
        const action = pendingExternalSuspensionAction.onContinue;
        setPendingExternalSuspensionAction(null);
        action();
      }
    },
    [
      endSuspensionAndContinue,
      endingExternalSuspensionId,
      pendingExternalSuspensionAction,
    ],
  );

  const undoEventById = useCallback(
    async (eventId: ClientId) => {
      if (isUndoingLastEvent || matchSync.status === "saving") {
        return;
      }

      setIsUndoingLastEvent(true);
      beginMatchSaving();

      try {
        if (collections.playerEventsCollection.get(eventId) === undefined) {
          await collections.playerEventsCollection.utils.refetch();
          if (collections.playerEventsCollection.get(eventId) === undefined) {
            markMatchSaved();
            return;
          }
        }

        const tx = collections.playerEventsCollection.delete(eventId);
        await awaitPlayerEventDeletionPersistence(collections, tx, eventId);
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
    [collections, isUndoingLastEvent, matchSync.status],
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
        activePlayerNumbers={activePlayerNumbers}
        activeSuspensions={activeSuspensions}
        getPlayerLabel={getPlayerLabel}
        isSuspensionEndBlocked={
          matchSync.status === "saving" || matchSync.status === "failed"
        }
        isSavingQuickSub={isSavingQuickSub}
        isSavingStarting7={isSavingStarting7}
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
        onEndSuspensionAndContinue={endSuspensionAndContinue}
        onQuickSub={handleQuickSubAttempt}
        onSaveStarting7={handleStarting7Attempt}
      />
      {pendingExternalSuspensionAction ? (
        <SuspensionWarningDialog
          getPlayerLabel={getPlayerLabel}
          isBlocked={
            matchSync.status === "saving" || matchSync.status === "failed"
          }
          isEnding={endingExternalSuspensionId !== null}
          onCancel={() => {
            const action = pendingExternalSuspensionAction.onCancel;
            setPendingExternalSuspensionAction(null);
            // Leave the parent picker open so the user can choose a different
            // player. Close it only when sync is blocked, because Continue/End
            // are disabled and cancel is the only way out of that dialog.
            if (
              matchSync.status === "saving" ||
              matchSync.status === "failed"
            ) {
              action();
            }
          }}
          onContinue={() => {
            const action = pendingExternalSuspensionAction.onContinue;
            setPendingExternalSuspensionAction(null);
            action();
          }}
          onEndAndContinue={
            pendingExternalSuspensionAction.allowEnd
              ? (suspension) => {
                  void handleEndExternalSuspensionAndContinue(suspension);
                }
              : undefined
          }
          open
          playerLabel={pendingExternalSuspensionAction.label}
          suspensions={pendingExternalSuspensionAction.suspensions}
        />
      ) : null}
    </>
  );
}

export default ActiveGame;

export { getActivePlayers } from "@/components/active-game/utils/activePlayers";
