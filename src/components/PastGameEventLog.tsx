"use client";

import { EventLog } from "@/components/EventLog";
import type { PlayerEvent } from "@/datamodel";

interface PastGameEventLogProps {
  events: PlayerEvent[];
  players: Array<{
    name: string;
    number: number;
  }>;
}

export function PastGameEventLog({ events, players }: PastGameEventLogProps) {
  const playerNameByNumber = new Map(
    players.map((player) => [player.number, player.name]),
  );

  return (
    <EventLog
      events={events}
      getPlayerLabel={(playerNumber) =>
        playerNameByNumber.get(playerNumber) ?? `#${playerNumber}`
      }
    />
  );
}
