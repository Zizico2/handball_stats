import { Card, Chip, Separator, Typography } from "@heroui/react";
import { formatHalfLabel } from "@/components/event-log/eventDisplay";
import type { PlayerEvent } from "@/datamodel";

interface StartingLineupCardProps {
  half: PlayerEvent["half"];
  getPlayerLabel: (number: number) => string;
  startingPlayers: PlayerEvent[];
}

export function StartingLineupCard({
  half,
  getPlayerLabel,
  startingPlayers,
}: StartingLineupCardProps) {
  return (
    <Card className="border border-separator bg-surface-secondary shadow-sm">
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
            {formatHalfLabel(half)}
          </Typography.Paragraph>
        </div>
        <Separator className="my-2" />
        <Typography.Paragraph className="font-medium">
          {startingPlayers
            .flatMap((event) =>
              "player" in event ? [getPlayerLabel(event.player)] : [],
            )
            .join(", ")}
        </Typography.Paragraph>
      </Card.Content>
    </Card>
  );
}
