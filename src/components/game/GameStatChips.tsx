import { Chip } from "@heroui/react";

interface GameStatChipsProps {
  teamScore: number;
  opponentScore: number;
  eventCount: number;
  playerCount?: number;
  eventLabel?: string;
}

export function GameStatChips({
  teamScore,
  opponentScore,
  eventCount,
  playerCount,
  eventLabel = "events",
}: GameStatChipsProps) {
  return (
    <>
      <Chip color="success" variant="secondary">
        {teamScore}–{opponentScore} score
      </Chip>
      <Chip variant="secondary">
        {eventCount} {eventLabel}
      </Chip>
      {playerCount !== undefined ? (
        <Chip variant="secondary">{playerCount} rostered players</Chip>
      ) : null}
    </>
  );
}
