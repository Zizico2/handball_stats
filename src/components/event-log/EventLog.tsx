"use client";

import { ScrollShadow, Typography } from "@heroui/react";
import { useMemo } from "react";
import { EventLogTimeline } from "@/components/event-log/EventLogTimeline";
import { UndoLastEventControl } from "@/components/event-log/UndoLastEventControl";
import type { PlayerEvent } from "@/datamodel";

interface EventLogProps {
  events: PlayerEvent[];
  getPlayerLabel?: (number: number) => string;
  playerLabels?: Record<number, string>;
  undoDisabled?: boolean;
  undoEventLabel?: string | null;
  onUndoLastEvent?: () => void;
}

export function EventLog({
  events,
  getPlayerLabel,
  playerLabels,
  undoDisabled = true,
  undoEventLabel = null,
  onUndoLastEvent,
}: EventLogProps) {
  const resolvePlayerLabel = useMemo(() => {
    if (getPlayerLabel) {
      return getPlayerLabel;
    }

    const labels = playerLabels ?? {};
    return (number: number) => labels[number] ?? `#${number}`;
  }, [getPlayerLabel, playerLabels]);

  return (
    <div className="mx-auto mt-8 w-full max-w-[600px]">
      {onUndoLastEvent ? (
        <UndoLastEventControl
          disabled={undoDisabled}
          eventLabel={undoEventLabel}
          onConfirmUndo={onUndoLastEvent}
        />
      ) : (
        <Typography.Heading level={4} className="mb-4 font-bold">
          Match Log
        </Typography.Heading>
      )}
      <ScrollShadow className="max-h-[400px] pr-2" orientation="vertical">
        <EventLogTimeline events={events} getPlayerLabel={resolvePlayerLabel} />
      </ScrollShadow>
    </div>
  );
}
