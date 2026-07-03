import { Card, Chip, Typography } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import NextLink from "next/link";
import { listPastGames } from "@/server/gameHistory";

function formatGameDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function PastGamesList() {
  const games = await listPastGames();

  if (games.length === 0) {
    return (
      <Card className="max-w-[720px] border border-separator">
        <Card.Content className="p-4">
          <Typography.Heading level={5}>No past games yet</Typography.Heading>
          <Typography.Paragraph color="muted" className="mt-2">
            Start and replace an active game to build up match history here.
          </Typography.Paragraph>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      {games.map((game) => (
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
      ))}
    </div>
  );
}
