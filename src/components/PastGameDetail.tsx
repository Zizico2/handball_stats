"use client";

import { Typography } from "@heroui/react";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import {
  gamesLiveQuery,
  playerEventsLiveQuery,
  teamPlayersLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import { AppNextLink } from "@/components/AppNextLink";
import { GameMetaLine } from "@/components/game/GameMetaLine";
import { GameStatChips } from "@/components/game/GameStatChips";
import { PastGameCsvDownloadButton } from "@/components/PastGameCsvDownloadButton";
import { PastGameEventLog } from "@/components/PastGameEventLog";
import type { ClientId } from "@/datamodel";
import { countGoals } from "@/lib/display/countGoals";
import { buildPastGameLog } from "@/lib/gameHistory";

export function PastGameDetailContent({ gameId }: { gameId: ClientId }) {
  const games = useLiveSuspenseQuery(gamesLiveQuery);
  const teams = useLiveSuspenseQuery(teamsLiveQuery);
  const teamPlayers = useLiveSuspenseQuery(teamPlayersLiveQuery);
  const playerEvents = useLiveSuspenseQuery(playerEventsLiveQuery);

  const gameLog = useMemo(
    () =>
      buildPastGameLog({
        gameId,
        games: games.data,
        teams: teams.data,
        teamPlayers: teamPlayers.data,
        playerEvents: playerEvents.data,
      }),
    [gameId, games.data, playerEvents.data, teamPlayers.data, teams.data],
  );

  if (!gameLog) return null;

  const score = countGoals(gameLog.events);

  return (
    <>
      <div>
        <Typography.Heading level={3}>
          {gameLog.game.homeTeamName}
        </Typography.Heading>
        <GameMetaLine
          className="mt-2"
          createdAt={gameLog.game.createdAt}
          dateStyle="full"
          gameId={gameLog.game.id}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <GameStatChips
          eventCount={gameLog.events.length}
          eventLabel="logged events"
          playerCount={gameLog.players.length}
          score={score}
        />
      </div>

      <PastGameCsvDownloadButton
        events={gameLog.events}
        fileName={`game-${gameLog.game.id}-player-events.csv`}
      />

      <PastGameEventLog events={gameLog.events} players={gameLog.players} />
    </>
  );
}

export function PastGameDetailShell() {
  return (
    <AppNextLink
      className="link inline-flex items-center gap-2 self-start"
      href="/past-games"
    >
      <ArrowLeft className="size-4" />
      Back to past games
    </AppNextLink>
  );
}
