import { Card, Chip, Typography } from "@heroui/react";
import { ChevronRight, History } from "lucide-react";
import NextLink from "next/link";
import { listPastGames } from "@/server/gameHistory";

function formatGameDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function PastGamesPage() {
  const games = await listPastGames();

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <History className="size-6 text-muted" />
          <Typography.Heading level={3}>Past Games</Typography.Heading>
        </div>
        <Typography.Paragraph color="muted">
          Open any finished game to inspect its event log.
        </Typography.Paragraph>
      </div>
      <div className="flex max-w-[720px] flex-col gap-4">
        {games.length === 0 ? (
          <Card className="border border-separator">
            <Card.Content className="p-4">
              <Typography.Heading level={5}>
                No past games yet
              </Typography.Heading>
              <Typography.Paragraph color="muted" className="mt-2">
                Start and replace an active game to build up match history here.
              </Typography.Paragraph>
            </Card.Content>
          </Card>
        ) : (
          games.map((game) => (
            <NextLink
              key={game.id}
              className="no-underline"
              href={`/past-games/${game.id}`}
            >
              <Card className="border border-separator transition-colors hover:bg-surface-secondary">
                <Card.Content className="p-4">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <Typography.Heading level={5}>
                        {game.homeTeamName}
                      </Typography.Heading>
                      <Typography.Paragraph color="muted" className="mt-1">
                        Game #{game.id} · {formatGameDate(game.createdAt)}
                      </Typography.Paragraph>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip color="success" variant="secondary">
                        {game.score} goals
                      </Chip>
                      <Chip variant="secondary">{game.eventCount} events</Chip>
                      <ChevronRight className="size-5 text-muted" />
                    </div>
                  </div>
                </Card.Content>
              </Card>
            </NextLink>
          ))
        )}
      </div>
    </div>
  );
}
