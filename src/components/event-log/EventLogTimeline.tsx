import { Typography } from "@heroui/react";
import { buildEventTimeline } from "@/components/event-log/buildEventTimeline";
import { EventLogCard } from "@/components/event-log/EventLogCard";
import { StartingLineupCard } from "@/components/event-log/StartingLineupCard";
import type { PlayerEvent } from "@/datamodel";

interface EventLogTimelineProps {
  events: PlayerEvent[];
  getPlayerLabel: (number: number) => string;
}

export function EventLogTimeline({
  events,
  getPlayerLabel,
}: EventLogTimelineProps) {
  const sortedItems = buildEventTimeline(events);

  if (sortedItems.length === 0) {
    return (
      <Typography.Paragraph color="muted" className="py-8 text-center">
        No events recorded yet.
      </Typography.Paragraph>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sortedItems.map((item) => {
        if (item.type === "startingLineup" && item.startingPlayers) {
          return (
            <StartingLineupCard
              key={item.id}
              getPlayerLabel={getPlayerLabel}
              half={item.half}
              startingPlayers={item.startingPlayers}
            />
          );
        }

        const event = item.event;
        if (!event) return null;

        return (
          <EventLogCard
            key={event.id}
            event={event}
            getPlayerLabel={getPlayerLabel}
          />
        );
      })}
    </div>
  );
}
