"use client";

import { useEffect, useState } from "react";
import type { ActorRefFrom, SnapshotFrom } from "xstate";
import { PickEventTypeDialog } from "@/components/active-game/dialogs/PickEventTypeDialog";
import { PickGoalOrNoGoalDialog } from "@/components/active-game/dialogs/PickGoalOrNoGoalDialog";
import { PickPlayerDialog } from "@/components/active-game/dialogs/PickPlayerDialog";
import { PickShotDirectionDialog } from "@/components/active-game/dialogs/PickShotDirectionDialog";
import { PickShotPositionDialog } from "@/components/active-game/dialogs/PickShotPositionDialog";
import { PickStarting7Dialog } from "@/components/active-game/dialogs/PickStarting7Dialog";
import { PickSuspensionServerDialog } from "@/components/active-game/dialogs/PickSuspensionServerDialog";
import { PickSuspensionToEndDialog } from "@/components/active-game/dialogs/PickSuspensionToEndDialog";
import { QuickSubDialog } from "@/components/active-game/dialogs/QuickSubDialog";
import { SuspensionWarningDialog } from "@/components/active-game/dialogs/SuspensionWarningDialog";
import type { ActiveSuspension } from "@/components/active-game/utils/activeSuspensions";
import type { EventGroup, QuickSubPair, TeamPlayer } from "@/datamodel";
import type { Event, eventMachine } from "@/event_form_fsm";

type EventMachineSnapshot = SnapshotFrom<typeof eventMachine>;
type EventMachineSend = ActorRefFrom<typeof eventMachine>["send"];

interface ActiveGameEventDialogsProps {
  activePlayerNumbers: Set<number>;
  activeSuspensions: ActiveSuspension[];
  getPlayerLabel: (number: number) => string;
  isSuspensionEndBlocked: boolean;
  isSavingQuickSub: boolean;
  isSavingStarting7: boolean;
  onCloseQuickSub: () => void;
  onCloseStarting7: () => void;
  onEndSuspensionAndContinue: (
    suspension: ActiveSuspension,
  ) => Promise<boolean>;
  onPickManually: () => void;
  onQuickSub: (playerOut: number, playerIn: number) => void;
  onSaveStarting7: (numbers: number[]) => void;
  quickSubDialogOpen: boolean;
  quickSubPairs: QuickSubPair[];
  selectedTeamPlayers: TeamPlayer[];
  send: EventMachineSend;
  starting7DialogOpen: boolean;
  startingPlayerNumbers: number[];
  state: EventMachineSnapshot;
}

interface PendingPlayerSelection {
  player: number;
  suspensions: ActiveSuspension[];
}

export function ActiveGameEventDialogs({
  activePlayerNumbers,
  activeSuspensions,
  getPlayerLabel,
  isSuspensionEndBlocked,
  isSavingQuickSub,
  isSavingStarting7,
  onCloseQuickSub,
  onCloseStarting7,
  onEndSuspensionAndContinue,
  onPickManually,
  onQuickSub,
  onSaveStarting7,
  quickSubDialogOpen,
  quickSubPairs,
  selectedTeamPlayers,
  send,
  starting7DialogOpen,
  startingPlayerNumbers,
  state,
}: ActiveGameEventDialogsProps) {
  const [pendingPlayerSelection, setPendingPlayerSelection] =
    useState<PendingPlayerSelection | null>(null);
  const [endingSuspensionId, setEndingSuspensionId] = useState<string | null>(
    null,
  );
  const dialogsLocked =
    state.matches("finished") || state.matches("persistFailed");

  useEffect(() => {
    if (
      !state.matches("pickingPlayer") &&
      !state.matches("pickingSubstitutionPlayerIn")
    ) {
      setPendingPlayerSelection(null);
    }
  }, [state]);

  const cancel = () => send({ type: "CANCEL" });

  const handlePickPlayer = (
    pickedPlayer: number | null,
    shouldWarn: boolean,
  ) => {
    if (dialogsLocked) {
      return;
    }
    if (pickedPlayer === null) {
      cancel();
      return;
    }

    const suspensions = activeSuspensions.filter(
      (suspension) =>
        suspension.offender === pickedPlayer ||
        suspension.servedBy === pickedPlayer,
    );
    if (shouldWarn && suspensions.length > 0) {
      setPendingPlayerSelection({ player: pickedPlayer, suspensions });
      return;
    }
    send({ type: "PICK_PLAYER", player: pickedPlayer });
  };

  const continuePendingPlayerSelection = () => {
    if (!pendingPlayerSelection) {
      return;
    }
    const player = pendingPlayerSelection.player;
    setPendingPlayerSelection(null);
    send({ type: "PICK_PLAYER", player });
  };

  const endSuspensionAndContinue = async (suspension: ActiveSuspension) => {
    if (!pendingPlayerSelection || endingSuspensionId !== null) {
      return;
    }
    setEndingSuspensionId(suspension.id);
    const ended = await onEndSuspensionAndContinue(suspension);
    setEndingSuspensionId(null);
    if (ended) {
      continuePendingPlayerSelection();
    }
  };

  const suspensionOffender = state.context.playerEvent.player;
  const isPickingSubstitutionEntry = state.matches(
    "pickingSubstitutionPlayerIn",
  );
  const isPickingSubstitutionExit =
    state.matches("pickingPlayer") &&
    state.context.playerEvent.eventType === "substitution";

  return (
    <>
      <PickPlayerDialog
        activePlayerNumbers={activePlayerNumbers}
        activeSuspensions={activeSuspensions}
        open={state.matches("pickingPlayer") && pendingPlayerSelection === null}
        players={selectedTeamPlayers}
        prioritizeActive
        selectionMode={isPickingSubstitutionExit ? "onCourtOnly" : "all"}
        title={
          isPickingSubstitutionExit ? "Pick Player Leaving" : "Pick a Player"
        }
        onPickPlayer={(pickedPlayer) =>
          handlePickPlayer(pickedPlayer, !isPickingSubstitutionExit)
        }
      />
      <PickPlayerDialog
        activePlayerNumbers={activePlayerNumbers}
        activeSuspensions={activeSuspensions}
        open={
          state.matches("pickingSubstitutionPlayerIn") &&
          pendingPlayerSelection === null
        }
        players={selectedTeamPlayers}
        prioritizeActive={false}
        selectionMode="benchOnly"
        title="Pick Player Entering"
        onPickPlayer={(pickedPlayer) =>
          handlePickPlayer(pickedPlayer, isPickingSubstitutionEntry)
        }
      />
      {pendingPlayerSelection ? (
        <SuspensionWarningDialog
          getPlayerLabel={getPlayerLabel}
          isBlocked={isSuspensionEndBlocked}
          isEnding={endingSuspensionId !== null}
          onCancel={() => {
            setPendingPlayerSelection(null);
            if (isSuspensionEndBlocked) {
              send({ type: "CANCEL" });
            }
          }}
          onContinue={continuePendingPlayerSelection}
          onEndAndContinue={(suspension) => {
            void endSuspensionAndContinue(suspension);
          }}
          open
          playerLabel={getPlayerLabel(pendingPlayerSelection.player)}
          suspensions={pendingPlayerSelection.suspensions}
        />
      ) : null}
      {starting7DialogOpen ? (
        <PickStarting7Dialog
          activePlayerNumbers={activePlayerNumbers}
          activeSuspensions={activeSuspensions}
          currentStartingNumbers={startingPlayerNumbers}
          isSaving={isSavingStarting7}
          open={starting7DialogOpen}
          players={selectedTeamPlayers}
          onClose={onCloseStarting7}
          onSave={onSaveStarting7}
        />
      ) : null}
      {quickSubDialogOpen ? (
        <QuickSubDialog
          activePlayerNumbers={activePlayerNumbers}
          activeSuspensions={activeSuspensions}
          isSaving={isSavingQuickSub}
          open={quickSubDialogOpen}
          pairs={quickSubPairs}
          players={selectedTeamPlayers}
          onClose={onCloseQuickSub}
          onPickManually={onPickManually}
          onQuickSub={onQuickSub}
        />
      ) : null}
      {state.matches("pickingSuspensionServer") &&
      typeof suspensionOffender === "number" ? (
        <PickSuspensionServerDialog
          activePlayerNumbers={activePlayerNumbers}
          activeSuspensions={activeSuspensions}
          offender={suspensionOffender}
          open
          players={selectedTeamPlayers}
          onPickServer={(pickedPlayer) => {
            if (pickedPlayer === null) {
              cancel();
            } else {
              send({ type: "PICK_SUSPENSION_SERVER", player: pickedPlayer });
            }
          }}
        />
      ) : null}
      <PickSuspensionToEndDialog
        activeSuspensions={activeSuspensions}
        getPlayerLabel={getPlayerLabel}
        open={state.matches("pickingSuspensionToEnd")}
        onPick={(selection) => {
          if (selection === null) {
            cancel();
          } else {
            send({
              type: "PICK_SUSPENSION_TO_END",
              player: selection.player,
              suspensionId: selection.suspensionId,
            });
          }
        }}
      />
      <PickShotDirectionDialog
        open={state.matches("pickingShotDirection")}
        onPick={(pick) => {
          if (dialogsLocked) {
            return;
          }
          if (pick) {
            send({ type: "PICK_SHOT_DIRECTION", pick });
          } else {
            cancel();
          }
        }}
      />
      <PickGoalOrNoGoalDialog
        open={state.matches("pickingGoalOrNoGoal")}
        onPickGoalOrNoGoal={(goal) => {
          if (dialogsLocked) {
            return;
          }
          if (goal !== null) {
            send({ type: "PICK_GOAL_OR_NO_GOAL", goal });
          } else {
            cancel();
          }
        }}
      />
      <PickShotPositionDialog
        open={state.matches("pickingShotPosition")}
        onPickShotPosition={(position) => {
          if (dialogsLocked) {
            return;
          }
          if (position) {
            send({ type: "PICK_SHOT_POSITION", position });
          } else {
            cancel();
          }
        }}
      />
      <PickEventTypeDialog
        group="attack"
        open={state.matches("startingAttack")}
        onPickEventType={(eventType) => {
          if (dialogsLocked) {
            return;
          }
          if (eventType) {
            send({ type: "PICK_ATTACK_EVENT_TYPE", eventType });
          } else {
            cancel();
          }
        }}
      />
      <PickEventTypeDialog
        group="defense"
        open={state.matches("startingDefense")}
        onPickEventType={(eventType) => {
          if (dialogsLocked) {
            return;
          }
          if (eventType) {
            send({ type: "PICK_DEFENSE_EVENT_TYPE", eventType });
          } else {
            cancel();
          }
        }}
      />
      <PickEventTypeDialog
        disabledEventTypes={
          activeSuspensions.length > 0
            ? new Set()
            : new Set(["twoMinuteSuspensionEnded"])
        }
        group="sanction"
        open={state.matches("startingSanction")}
        onPickEventType={(eventType) => {
          if (dialogsLocked) {
            return;
          }
          if (eventType) {
            send({ type: "PICK_SANCTION_EVENT_TYPE", eventType });
          } else {
            cancel();
          }
        }}
      />
    </>
  );
}

export type { Event, EventGroup };
