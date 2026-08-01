import { Typography } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AppNextLink } from "@/components/AppNextLink";
import { GameMetaLine } from "@/components/game/GameMetaLine";
import { GameStatChips } from "@/components/game/GameStatChips";
import { PastGameCsvDownloadButton } from "@/components/PastGameCsvDownloadButton";
import { PastGameEventLog } from "@/components/PastGameEventLog";
import { clientIdSchema } from "@/datamodel";
import { countGoals } from "@/lib/display/countGoals";
import {
  getPastGameLog,
  getPastGamePlayerEventsCsv,
} from "@/server/gameHistory";

export async function PastGameDetailContent({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const resolvedParams = await params;
  const parsedGameId = clientIdSchema.safeParse(resolvedParams.gameId);

  if (!parsedGameId.success) {
    notFound();
  }
  const gameId = parsedGameId.data;

  const [gameLog, csvPayload] = await Promise.all([
    getPastGameLog(gameId),
    getPastGamePlayerEventsCsv(gameId),
  ]);

  if (!gameLog) {
    notFound();
  }

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
        csv={csvPayload?.csv ?? ""}
        fileName={
          csvPayload?.fileName ?? `game-${gameLog.game.id}-player-events.csv`
        }
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
