import { Typography } from "@heroui/react";
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

interface ActiveGameViewProps {
  activeGameEvents: PlayerEvent[];
  activePlayerNumbers: Set<number>;
  eventButtonsDisabled: boolean;
  getPlayerLabel: (number: number) => string;
  hasActiveGame: boolean;
  matchClock: { minutes: number; seconds: number };
  onRecordEvent: (group: EventGroup) => void;
  onSetStartingLineup: () => void;
  selectedTeamPlayers: TeamPlayer[];
  startingPlayerNumbers: number[];
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
  selectedTeamPlayers,
  startingPlayerNumbers,
}: ActiveGameViewProps) {
  return (
    <div className="h-full w-full">
      <div className="mx-auto flex w-fit flex-col gap-4">
        <MatchClock minutes={matchClock.minutes} seconds={matchClock.seconds} />
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
      </div>
      <EventLog events={activeGameEvents} getPlayerLabel={getPlayerLabel} />
    </div>
  );
}
