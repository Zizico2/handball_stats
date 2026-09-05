"use client";

import { Card, Typography } from "@heroui/react";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  activeGameLiveQuery,
  gamesLiveQuery,
  playerEventsLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import { AppNextLink } from "@/components/AppNextLink";
import { GameMetaLine } from "@/components/game/GameMetaLine";
import { GameStatChips } from "@/components/game/GameStatChips";
import { buildPastGameSummaries } from "@/lib/gameHistory";

export function PastGamesList() {
  const games = useLiveSuspenseQuery(gamesLiveQuery);
  const teams = useLiveSuspenseQuery(teamsLiveQuery);
  const playerEvents = useLiveSuspenseQuery(playerEventsLiveQuery);
  const activeGame = useLiveSuspenseQuery(activeGameLiveQuery);

  const pastGames = useMemo(
    () =>
      buildPastGameSummaries({
        games: games.data,
        teams: teams.data,
        playerEvents: playerEvents.data,
        activeGame: activeGame.data,
      }),
    [activeGame.data, games.data, playerEvents.data, teams.data],
  );

  if (pastGames.length === 0) {
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
      {pastGames.map((game) => (
        <AppNextLink
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
                  <GameMetaLine
                    className="mt-1"
                    createdAt={game.createdAt}
                    gameId={game.id}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GameStatChips
                    eventCount={game.eventCount}
                    score={game.score}
                  />
                  <ChevronRight className="size-5 text-muted" />
                </div>
              </div>
            </Card.Content>
          </Card>
        </AppNextLink>
      ))}
    </div>
  );
}
