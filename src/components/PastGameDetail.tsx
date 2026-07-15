import { Typography } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { GameMetaLine } from "@/components/game/GameMetaLine";
import { GameStatChips } from "@/components/game/GameStatChips";
import { PastGameCsvDownloadButton } from "@/components/PastGameCsvDownloadButton";
import { PastGameEventLog } from "@/components/PastGameEventLog";
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
  const gameId = Number(resolvedParams.gameId);

  if (!Number.isInteger(gameId)) {
    notFound();
  }

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
    <NextLink
      className="link inline-flex items-center gap-2 self-start"
      href="/past-games"
      prefetch={false}
    >
      <ArrowLeft className="size-4" />
      Back to past games
    </NextLink>
  );
}
