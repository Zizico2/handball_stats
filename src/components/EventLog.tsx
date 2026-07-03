"use client";

import { Card, Chip, ScrollShadow, Separator, Typography } from "@heroui/react";
import { ArrowLeftRight } from "lucide-react";
import type { PlayerEvent } from "@/datamodel";

interface EventLogProps {
  events: PlayerEvent[];
  getPlayerLabel: (number: number) => string;
}

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

function getEventGroupColor(group: string): ChipColor {
  switch (group) {
    case "attack":
      return "warning";
    case "defense":
      return "accent";
    case "sanction":
      return "danger";
    case "substitution":
      return "success";
    default:
      return "default";
  }
}

export function EventLog({ events, getPlayerLabel }: EventLogProps) {
  const formatElapsed = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const firstHalfStarting = events.filter(
    (e) => e.eventType === "startingPlayer" && e.half === "firstHalf",
  );
  const secondHalfStarting = events.filter(
    (e) => e.eventType === "startingPlayer" && e.half === "secondHalf",
  );
  const gameplayEvents = events.filter((e) => e.eventType !== "startingPlayer");

  interface TimelineItem {
    type: "event" | "startingLineup";
    id: string | number;
    half: "firstHalf" | "secondHalf";
    ellapsed_seconds: number;
    event?: PlayerEvent;
    startingPlayers?: PlayerEvent[];
  }

  const items: TimelineItem[] = [];

  for (const e of gameplayEvents) {
    items.push({
      type: "event",
      id: `event-${e.id}`,
      half: e.half,
      ellapsed_seconds: e.ellapsed_seconds,
      event: e,
    });
  }

  if (firstHalfStarting.length > 0) {
    items.push({
      type: "startingLineup",
      id: "starting-firstHalf",
      half: "firstHalf",
      ellapsed_seconds: 0,
      startingPlayers: firstHalfStarting,
    });
  }

  if (secondHalfStarting.length > 0) {
    items.push({
      type: "startingLineup",
      id: "starting-secondHalf",
      half: "secondHalf",
      ellapsed_seconds: 0,
      startingPlayers: secondHalfStarting,
    });
  }

  const sortedItems = [...items].sort((a, b) => {
    if (a.half === "secondHalf" && b.half === "firstHalf") return -1;
    if (a.half === "firstHalf" && b.half === "secondHalf") return 1;

    if (b.ellapsed_seconds !== a.ellapsed_seconds) {
      return b.ellapsed_seconds - a.ellapsed_seconds;
    }

    if (a.type === "startingLineup" && b.type !== "startingLineup") return 1;
    if (a.type !== "startingLineup" && b.type === "startingLineup") return -1;

    const aId = a.event ? a.event.id : 0;
    const bId = b.event ? b.event.id : 0;
    return bId - aId;
  });

  return (
    <div className="mx-auto mt-8 w-full max-w-[600px]">
      <Typography.Heading level={4} className="mb-4 font-bold">
        Match Log
      </Typography.Heading>
      <ScrollShadow className="max-h-[400px] pr-2" orientation="vertical">
        <div className="flex flex-col gap-3">
          {sortedItems.length === 0 ? (
            <Typography.Paragraph color="muted" className="py-8 text-center">
              No events recorded yet.
            </Typography.Paragraph>
          ) : (
            sortedItems.map((item) => {
              if (item.type === "startingLineup" && item.startingPlayers) {
                return (
                  <Card
                    key={item.id}
                    className="border border-separator bg-surface-secondary shadow-sm"
                  >
                    <Card.Content className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Typography.Code className="rounded bg-default px-2 py-0.5 font-mono font-bold">
                            00:00
                          </Typography.Code>
                          <Chip color="accent" size="sm" variant="secondary">
                            STARTING LINEUP
                          </Chip>
                        </div>
                        <Typography.Paragraph color="muted" className="text-xs">
                          {item.half === "firstHalf" ? "1st Half" : "2nd Half"}
                        </Typography.Paragraph>
                      </div>
                      <Separator className="my-2" />
                      <Typography.Paragraph className="font-medium">
                        {item.startingPlayers
                          .map((e) => getPlayerLabel(e.player))
                          .join(", ")}
                      </Typography.Paragraph>
                    </Card.Content>
                  </Card>
                );
              }

              const event = item.event;
              if (!event) return null;
              return (
                <Card
                  key={event.id}
                  className="border border-separator shadow-sm"
                >
                  <Card.Content className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Typography.Code className="rounded bg-default px-2 py-0.5 font-mono font-bold">
                          {formatElapsed(event.ellapsed_seconds)}
                        </Typography.Code>
                        <Chip
                          color={getEventGroupColor(event.eventGroup)}
                          size="sm"
                          variant="secondary"
                        >
                          {event.eventGroup.toUpperCase()}
                        </Chip>
                      </div>
                      <Typography.Paragraph color="muted" className="text-xs">
                        {event.half === "firstHalf" ? "1st Half" : "2nd Half"}
                      </Typography.Paragraph>
                    </div>

                    <Separator className="my-2" />

                    {event.eventType === "substitution" ? (
                      <div className="mt-1 flex items-center gap-2">
                        <Typography.Paragraph className="font-medium text-danger">
                          {getPlayerLabel(event.player)}
                        </Typography.Paragraph>
                        <ArrowLeftRight className="size-4 text-muted" />
                        <Typography.Paragraph className="font-medium text-success">
                          {getPlayerLabel(event.event.playerIn)}
                        </Typography.Paragraph>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <Typography.Paragraph className="font-medium">
                          {getPlayerLabel(event.player)} —{" "}
                          <span className="capitalize">
                            {event.eventType.replace(/([A-Z])/g, " $1")}
                          </span>
                        </Typography.Paragraph>
                        {"event" in event && event.eventType === "shot" && (
                          <Typography.Paragraph color="muted" className="mt-1">
                            Goal:{" "}
                            <strong>{event.event.goal ? "Yes" : "No"}</strong>
                            {event.event.direction &&
                              ` | Direction: ${event.event.direction}`}
                            {event.event.aim && ` | Aim: ${event.event.aim}`}
                          </Typography.Paragraph>
                        )}
                      </div>
                    )}
                  </Card.Content>
                </Card>
              );
            })
          )}
        </div>
      </ScrollShadow>
    </div>
  );
}
