import {
  buildEventLogPlayerLabels,
  EventLog,
} from "@/components/event-log/EventLog";
import type { PlayerEvent } from "@/datamodel";

interface PastGameEventLogProps {
  events: PlayerEvent[];
  players: Array<{
    name: string;
    number: number;
  }>;
}

export function PastGameEventLog({ events, players }: PastGameEventLogProps) {
  return (
    <EventLog
      events={events}
      playerLabels={buildEventLogPlayerLabels(players)}
    />
  );
}
