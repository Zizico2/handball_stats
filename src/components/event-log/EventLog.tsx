"use client";

import { ScrollShadow, Typography } from "@heroui/react";
import { useMemo } from "react";
import { EventLogTimeline } from "@/components/event-log/EventLogTimeline";
import type { PlayerEvent } from "@/datamodel";
import { buildPlayerLabelMap } from "@/lib/display/formatPlayerLabel";

interface EventLogProps {
  events: PlayerEvent[];
  getPlayerLabel?: (number: number) => string;
  playerLabels?: Record<number, string>;
}

export function EventLog({
  events,
  getPlayerLabel,
  playerLabels,
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
      <Typography.Heading level={4} className="mb-4 font-bold">
        Match Log
      </Typography.Heading>
      <ScrollShadow className="max-h-[400px] pr-2" orientation="vertical">
        <EventLogTimeline events={events} getPlayerLabel={resolvePlayerLabel} />
      </ScrollShadow>
    </div>
  );
}

export function buildEventLogPlayerLabels(
  players: Array<{ number: number; name: string }>,
): Record<number, string> {
  return buildPlayerLabelMap(players);
}
