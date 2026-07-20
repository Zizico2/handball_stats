"use client";

import { Typography } from "@heroui/react";
import { useAtomValue } from "jotai";
import { AppNextLink } from "@/components/AppNextLink";
import { EventGroupButtons } from "@/components/active-game/EventGroupButtons";
import { MatchClock } from "@/components/active-game/MatchClock";
import {
  OnCourtChips,
  StartingLineupPrompt,
} from "@/components/active-game/OnCourtChips";
import { EventLog } from "@/components/event-log/EventLog";
import { MatchSyncFailureCallout } from "@/components/MatchSyncFailureCallout";
import type { EventGroup, PlayerEvent, TeamPlayer } from "@/datamodel";
import {
  type ActiveGameControlsState,
  inGameControlsAtom,
  type PrimaryClockAction,
} from "@/inGameControlsAtoms";
import { matchSyncAtom } from "@/matchSyncAtom";

interface ActiveGameViewProps {
  activeGameEvents: PlayerEvent[];
  activePlayerNumbers: Set<number>;
  eventButtonsDisabled: boolean;
  getPlayerLabel: (number: number) => string;
  hasActiveGame: boolean;
  matchClock: { minutes: number; seconds: number };
  onRecordEvent: (group: EventGroup) => void;
  onSetStartingLineup: () => void;
  onUndoLastEvent: () => void;
  selectedTeamPlayers: TeamPlayer[];
  startingPlayerNumbers: number[];
  undoDisabled: boolean;
  undoEventLabel: string | null;
}

function runPrimaryClockAction(
  action: PrimaryClockAction,
  controls: ActiveGameControlsState,
) {
  switch (action) {
    case "start-first-half":
      controls.onStartFirstHalf();
      break;
    case "start-halftime":
      controls.onStartHalftime();
      break;
    case "start-second-half":
      controls.onStartSecondHalf();
      break;
    case "toggle-pause":
      controls.onTogglePause();
      break;
  }
}

export function ActiveGameView({
  activeGameEvents,
  activePlayerNumbers,
  eventButtonsDisabled,
  getPlayerLabel,
  hasActiveGame,
  matchClock,
  onRecordEvent,
  onSetStartingLineup,
  onUndoLastEvent,
  selectedTeamPlayers,
  startingPlayerNumbers,
  undoDisabled,
  undoEventLabel,
}: ActiveGameViewProps) {
  const inGameControls = useAtomValue(inGameControlsAtom);
  const matchSync = useAtomValue(matchSyncAtom);
  const hasUnresolvedMutation =
    matchSync.status === "saving" || matchSync.status === "failed";

  return (
    <div className="h-full w-full px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
        <MatchClock
          hasActiveGame={hasActiveGame}
          isRunning={inGameControls.isRunning}
          matchStatus={inGameControls.matchStatus}
          minutes={matchClock.minutes}
          seconds={matchClock.seconds}
          primaryActionDisabled={
            inGameControls.primaryClockActionDisabled || hasUnresolvedMutation
          }
          primaryActionLabel={inGameControls.primaryClockActionLabel}
          showHalftimeAction={inGameControls.matchStatus === "firstHalf"}
          halftimeDisabled={
            inGameControls.isClockMutationPending || hasUnresolvedMutation
          }
          onPrimaryAction={() => {
            runPrimaryClockAction(
              inGameControls.primaryClockAction,
              inGameControls,
            );
          }}
          onStartHalftime={inGameControls.onStartHalftime}
        />
        <MatchSyncFailureCallout />
        {!hasActiveGame ? (
          <div className="flex flex-col gap-2">
            <Typography.Paragraph color="muted">
              No active game. Choose a home team first.
            </Typography.Paragraph>
            <AppNextLink className="link" href="/new-game">
              Go to New Game
            </AppNextLink>
          </div>
        ) : startingPlayerNumbers.length === 0 ? (
          <StartingLineupPrompt onSetStartingLineup={onSetStartingLineup} />
        ) : (
          <OnCourtChips
            activePlayerNumbers={activePlayerNumbers}
            selectedTeamPlayers={selectedTeamPlayers}
          />
        )}
        <EventGroupButtons
          disabled={eventButtonsDisabled}
          onRecordEvent={onRecordEvent}
        />
        <EventLog
          events={activeGameEvents}
          getPlayerLabel={getPlayerLabel}
          undoDisabled={undoDisabled}
          undoEventLabel={undoEventLabel}
          onUndoLastEvent={onUndoLastEvent}
        />
      </div>
    </div>
  );
}
