import {
  Separator,
  Skeleton,
  Surface,
  Toolbar,
  Typography,
} from "@heroui/react";

export default function AppShellSkeleton() {
  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden">
      <div className="flex h-full w-full flex-row">
        <Surface
          aria-hidden
          className="hidden h-full w-60 shrink-0 border-r border-separator sm:block"
          variant="default"
        >
          <div className="h-14" />
          <Separator />
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }, (_, index) => `nav-${index}`).map(
              (id) => (
                <Skeleton key={id} className="h-9 w-full rounded-lg" />
              ),
            )}
          </div>
        </Surface>

        <div className="flex w-full flex-col">
          <Surface
            className="shrink-0 border-b border-separator"
            variant="default"
          >
            <Toolbar className="flex w-full min-h-14 items-center gap-2 px-2">
              <Typography.Heading level={4} className="min-w-0 flex-1 truncate">
                Arcazzi
              </Typography.Heading>
            </Toolbar>
          </Surface>

          <main className="flex min-h-0 flex-1 flex-col p-6">
            <Skeleton className="mb-4 h-8 w-48 rounded-lg" />
            <Skeleton className="h-32 w-full max-w-xl rounded-xl" />
          </main>
        </div>
      </div>
    </div>
  );
}
