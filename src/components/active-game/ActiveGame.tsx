"use client";

import { useMachine } from "@xstate/react";
import { useState } from "react";
import { assign } from "xstate";
import { playerEventsCollection } from "@/collections";
import { ActiveGameEventDialogs } from "@/components/active-game/ActiveGameEventDialogs";
import { ActiveGameView } from "@/components/active-game/ActiveGameView";
import { useActiveGameControls } from "@/components/active-game/hooks/useActiveGameControls";
import { useActiveGameData } from "@/components/active-game/hooks/useActiveGameData";
import { insertPlayerEvent } from "@/components/active-game/utils/insertPlayerEvent";
import type { EventGroup } from "@/datamodel";
import { eventMachine } from "@/event_form_fsm";
import { usePlayerLabelMap } from "@/hooks/usePlayerLabelMap";
import type { MatchStatus } from "@/inGameControlsAtoms";

function ActiveGame() {
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [starting7DialogOpen, setStarting7DialogOpen] = useState(false);
  const [quickSubDialogOpen, setQuickSubDialogOpen] = useState(false);

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

  const [state, send] = useMachine(
    eventMachine.provide({
      actions: {
        finishEvent: assign(({ context }) => {
          insertPlayerEvent(context.playerEvent);
          return {};
        }),
      },
    }),
  );

  const handleStartEvent = (eventGroup: EventGroup) => {
    if (!activeGame.data || !activeHalf) {
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

  const handleSaveStarting7 = (numbers: number[]) => {
    if (!activeGameData) return;

    const existingStarting = activeGameEvents.filter(
      (event) =>
        event.eventType === "startingPlayer" &&
        event.half === currentHalfForStarting,
    );

    for (const event of existingStarting) {
      playerEventsCollection.delete(event.id);
    }

    numbers.forEach((num, index) => {
      insertPlayerEvent({
        id: nextEventId + index,
        player: num,
        game_id: activeGameData.gameId,
        ellapsed_seconds: 0,
        half: currentHalfForStarting,
        eventType: "startingPlayer",
        eventGroup: "substitution",
      });
    });

    setStarting7DialogOpen(false);
  };

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

  return (
    <>
      <ActiveGameView
        activeGameEvents={activeGameEvents}
        activePlayerNumbers={activePlayerNumbers}
        eventButtonsDisabled={
          !activeGame.data ||
          selectedTeamPlayers.length === 0 ||
          startingPlayerNumbers.length === 0 ||
          !(matchStatus === "firstHalf" || matchStatus === "secondHalf")
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
        selectedTeamPlayers={selectedTeamPlayers}
        startingPlayerNumbers={startingPlayerNumbers}
      />
      <ActiveGameEventDialogs
        activeGameGameId={activeGame.data?.gameId ?? null}
        activeHalf={activeHalf}
        activePlayerNumbers={activePlayerNumbers}
        eventElapsedSeconds={eventElapsedSeconds}
        nextEventId={nextEventId}
        quickSubDialogOpen={quickSubDialogOpen}
        quickSubPairs={teamQuickSubPairs}
        selectedTeamPlayers={selectedTeamPlayers}
        send={send}
        starting7DialogOpen={starting7DialogOpen}
        startingPlayerNumbers={startingPlayerNumbers}
        state={state}
        onCloseQuickSub={() => setQuickSubDialogOpen(false)}
        onCloseStarting7={() => setStarting7DialogOpen(false)}
        onPickManually={handlePickManually}
        onSaveStarting7={handleSaveStarting7}
      />
    </>
  );
}

export default ActiveGame;

export { getActivePlayers } from "@/components/active-game/utils/activePlayers";
