import { Card, Chip, Skeleton, Typography } from "@heroui/react";
import { History } from "lucide-react";

export function PastGamesHeader() {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <History className="size-6 text-muted" />
        <Typography.Heading level={3}>Past Games</Typography.Heading>
      </div>
      <Typography.Paragraph color="muted">
        Open any finished game to inspect its event log.
      </Typography.Paragraph>
    </div>
  );
}

export function PastGamesListSkeleton() {
  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      {Array.from({ length: 3 }, (_, index) => `game-${index}`).map((id) => (
        <Card key={id} className="border border-separator">
          <Card.Content className="p-4">
            <Skeleton className="mb-2 h-6 w-40 rounded-lg" />
            <Skeleton className="h-4 w-56 rounded-lg" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}

export function PastGameDetailHeaderSkeleton() {
  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <Skeleton className="h-5 w-36 rounded-lg" />
      <div>
        <Skeleton className="mb-2 h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip variant="secondary">
          <Skeleton className="h-4 w-16 rounded" />
        </Chip>
        <Chip variant="secondary">
          <Skeleton className="h-4 w-24 rounded" />
        </Chip>
      </div>
    </div>
  );
}

export function PastGameEventLogSkeleton() {
  return (
    <div className="flex max-w-[900px] flex-col gap-3">
      {Array.from({ length: 5 }, (_, index) => `event-${index}`).map((id) => (
        <Skeleton key={id} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
