import { Skeleton, Typography } from "@heroui/react";

export function NewGamePageSkeleton() {
  return (
    <div className="flex justify-center p-6">
      <div className="flex w-full max-w-[560px] flex-col gap-4">
        <Typography.Heading level={3}>New Game</Typography.Heading>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ActiveGamePageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => `player-${index}`).map(
              (id) => (
                <Skeleton key={id} className="h-20 rounded-xl" />
              ),
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-28 rounded-lg" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function CreateTeamsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <Typography.Heading level={3}>Create Teams</Typography.Heading>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }, (_, index) => `team-${index}`).map((id) => (
          <Skeleton key={id} className="h-36 w-full max-w-2xl rounded-xl" />
        ))}
      </div>
    </div>
  );
}
