import { Button, Chip, Typography } from "@heroui/react";
import type { MatchStatus } from "@/inGameControlsAtoms";
import {
  formatClockRunningState,
  formatMatchPhase,
} from "@/lib/display/formatMatchPhase";
import { formatClockDigits } from "@/lib/display/formatMatchTime";

interface MatchClockProps {
  minutes: number;
  seconds: number;
  matchStatus: MatchStatus | null;
  isRunning: boolean;
  hasActiveGame: boolean;
  primaryActionLabel: string | null;
  primaryActionDisabled: boolean;
  onPrimaryAction: () => void;
  showHalftimeAction?: boolean;
  halftimeDisabled?: boolean;
  onStartHalftime?: () => void;
}

export function MatchClock({
  minutes,
  seconds,
  matchStatus,
  isRunning,
  hasActiveGame,
  primaryActionLabel,
  primaryActionDisabled,
  onPrimaryAction,
  showHalftimeAction = false,
  halftimeDisabled = true,
  onStartHalftime,
}: MatchClockProps) {
  const phaseLabel = formatMatchPhase(matchStatus);
  const runningLabel = formatClockRunningState(matchStatus, isRunning);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Typography.Heading level={4} className="mr-auto">
          Match Clock
        </Typography.Heading>
        {hasActiveGame ? (
          <>
            <Chip size="sm" variant="secondary">
              {phaseLabel}
            </Chip>
            <Chip
              color={isRunning ? "success" : "warning"}
              size="sm"
              variant="secondary"
            >
              {runningLabel}
            </Chip>
          </>
        ) : null}
      </div>
      <Typography.Paragraph className="font-mono text-3xl tracking-tight">
        {formatClockDigits(minutes, seconds)}
      </Typography.Paragraph>
      {hasActiveGame && primaryActionLabel ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="min-h-11 min-w-[11rem] flex-1"
            isDisabled={primaryActionDisabled}
            variant="primary"
            onPress={onPrimaryAction}
          >
            {primaryActionLabel}
          </Button>
          {showHalftimeAction && onStartHalftime ? (
            <Button
              className="min-h-11 flex-1"
              isDisabled={halftimeDisabled}
              variant="secondary"
              onPress={onStartHalftime}
            >
              Start halftime
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
