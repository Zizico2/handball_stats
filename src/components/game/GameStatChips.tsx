import { Chip } from "@heroui/react";

interface GameStatChipsProps {
  score: number;
  eventCount: number;
  playerCount?: number;
  scoreLabel?: string;
  eventLabel?: string;
}

export function GameStatChips({
  score,
  eventCount,
  playerCount,
  scoreLabel = "goals",
  eventLabel = "events",
}: GameStatChipsProps) {
  return (
    <>
      <Chip color="success" variant="secondary">
        {score} {scoreLabel}
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
