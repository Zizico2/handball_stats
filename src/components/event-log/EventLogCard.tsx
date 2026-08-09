import { Card, Chip, Separator, Typography } from "@heroui/react";
import { ArrowLeftRight } from "lucide-react";
import {
  formatHalfLabel,
  getEventGroupColor,
} from "@/components/event-log/eventDisplay";
import type { PlayerEvent } from "@/datamodel";
import { formatMatchTime } from "@/lib/display/formatMatchTime";

interface EventLogCardProps {
  event: PlayerEvent;
  getPlayerLabel: (number: number) => string;
}

export function EventLogCard({ event, getPlayerLabel }: EventLogCardProps) {
  return (
    <Card className="border border-separator shadow-sm">
      <Card.Content className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Typography.Code className="rounded bg-default px-2 py-0.5 font-mono font-bold">
              {formatMatchTime(event.ellapsed_seconds)}
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
            {formatHalfLabel(event.half)}
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
            {event.eventType === "twoMinuteSuspension" &&
            event.event.servedBy !== event.player ? (
              <Typography.Paragraph color="muted" className="mt-1">
                Served by {getPlayerLabel(event.event.servedBy)}
              </Typography.Paragraph>
            ) : null}
            {event.eventType === "shot" && (
              <Typography.Paragraph color="muted" className="mt-1">
                Goal: <strong>{event.event.goal ? "Yes" : "No"}</strong>
                {` | Position: ${event.event.position}`}
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
}
