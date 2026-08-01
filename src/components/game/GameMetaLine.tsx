import { Typography } from "@heroui/react";
import type { ClientId } from "@/datamodel";
import { formatGameDate } from "@/lib/display/formatGameDate";

interface GameMetaLineProps {
  gameId: ClientId;
  createdAt: string;
  dateStyle?: "medium" | "full";
  className?: string;
}

export function GameMetaLine({
  gameId,
  createdAt,
  dateStyle = "medium",
  className,
}: GameMetaLineProps) {
  return (
    <Typography.Paragraph color="muted" className={className}>
      Game #{gameId.slice(-8)} · {formatGameDate(createdAt, dateStyle)}
    </Typography.Paragraph>
  );
}
