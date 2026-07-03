"use client";

import type { ActorRefFrom, SnapshotFrom } from "xstate";
import { PickEventTypeDialog } from "@/components/active-game/dialogs/PickEventTypeDialog";
import { PickGoalOrNoGoalDialog } from "@/components/active-game/dialogs/PickGoalOrNoGoalDialog";
import { PickPlayerDialog } from "@/components/active-game/dialogs/PickPlayerDialog";
import { PickShotDirectionDialog } from "@/components/active-game/dialogs/PickShotDirectionDialog";
import { PickShotPositionDialog } from "@/components/active-game/dialogs/PickShotPositionDialog";
import { PickStarting7Dialog } from "@/components/active-game/dialogs/PickStarting7Dialog";
import { QuickSubDialog } from "@/components/active-game/dialogs/QuickSubDialog";
import { insertPlayerEvent } from "@/components/active-game/utils/insertPlayerEvent";
import type {
  EventGroup,
  MatchHalf,
  QuickSubPair,
  TeamPlayer,
} from "@/datamodel";
import type { Event, eventMachine } from "@/event_form_fsm";

type EventMachineSnapshot = SnapshotFrom<typeof eventMachine>;
type EventMachineSend = ActorRefFrom<typeof eventMachine>["send"];

interface ActiveGameEventDialogsProps {
  activeGameGameId: number | null;
  activeHalf: MatchHalf | null;
  activePlayerNumbers: Set<number>;
  eventElapsedSeconds: number;
  nextEventId: number;
  onCloseQuickSub: () => void;
  onCloseStarting7: () => void;
  onPickManually: () => void;
  onSaveStarting7: (numbers: number[]) => void;
  quickSubDialogOpen: boolean;
  quickSubPairs: QuickSubPair[];
  selectedTeamPlayers: TeamPlayer[];
  send: EventMachineSend;
  starting7DialogOpen: boolean;
  startingPlayerNumbers: number[];
  state: EventMachineSnapshot;
}

export function ActiveGameEventDialogs({
  activeGameGameId,
  activeHalf,
  activePlayerNumbers,
  eventElapsedSeconds,
  nextEventId,
  onCloseQuickSub,
  onCloseStarting7,
  onPickManually,
  onSaveStarting7,
  quickSubDialogOpen,
  quickSubPairs,
  selectedTeamPlayers,
  send,
  starting7DialogOpen,
  startingPlayerNumbers,
  state,
}: ActiveGameEventDialogsProps) {
  const cancel = () => send({ type: "CANCEL" });

  return (
    <>
      <PickPlayerDialog
        activePlayerNumbers={activePlayerNumbers}
        open={state.matches("pickingPlayer")}
        players={selectedTeamPlayers}
        prioritizeActive
        selectionMode={
          state.context.playerEvent.eventType === "substitution"
            ? "onCourtOnly"
            : "all"
        }
        title={
          state.context.playerEvent.eventType === "substitution"
            ? "Pick Player Leaving"
            : "Pick a Player"
        }
        onPickPlayer={(pickedPlayer) => {
          if (pickedPlayer) {
            send({ type: "PICK_PLAYER", player: pickedPlayer });
          } else {
            cancel();
          }
        }}
      />
      <PickPlayerDialog
        activePlayerNumbers={activePlayerNumbers}
        open={state.matches("pickingSubstitutionPlayerIn")}
        players={selectedTeamPlayers}
        prioritizeActive={false}
        selectionMode="benchOnly"
        title="Pick Player Entering"
        onPickPlayer={(pickedPlayer) => {
          if (pickedPlayer) {
            send({ type: "PICK_PLAYER", player: pickedPlayer });
          } else {
            cancel();
          }
        }}
      />
      {starting7DialogOpen ? (
        <PickStarting7Dialog
          currentStartingNumbers={startingPlayerNumbers}
          open={starting7DialogOpen}
          players={selectedTeamPlayers}
          onClose={onCloseStarting7}
          onSave={onSaveStarting7}
        />
      ) : null}
      {quickSubDialogOpen && activeHalf && activeGameGameId !== null ? (
        <QuickSubDialog
          activePlayerNumbers={activePlayerNumbers}
          open={quickSubDialogOpen}
          pairs={quickSubPairs}
          players={selectedTeamPlayers}
          onClose={onCloseQuickSub}
          onPickManually={onPickManually}
          onQuickSub={(playerOut, playerIn) => {
            insertPlayerEvent({
              id: nextEventId,
              player: playerOut,
              game_id: activeGameGameId,
              ellapsed_seconds: eventElapsedSeconds,
              half: activeHalf,
              eventType: "substitution",
              eventGroup: "substitution",
              event: { playerIn },
            });
            onCloseQuickSub();
          }}
        />
      ) : null}
      <PickShotDirectionDialog
        open={state.matches("pickingShotDirection")}
        onPick={(pick) => {
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
          if (eventType) {
            send({ type: "PICK_DEFENSE_EVENT_TYPE", eventType });
          } else {
            cancel();
          }
        }}
      />
      <PickEventTypeDialog
        group="sanction"
        open={state.matches("startingSanction")}
        onPickEventType={(eventType) => {
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
