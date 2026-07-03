import { Chip, Typography } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { PastGameCsvDownloadButton } from "@/components/PastGameCsvDownloadButton";
import { PastGameEventLog } from "@/components/PastGameEventLog";
import {
  getPastGameLog,
  getPastGamePlayerEventsCsv,
} from "@/server/gameHistory";

interface PastGameDetailPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

function formatGameDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function PastGameDetailPage({
  params,
}: PastGameDetailPageProps) {
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

  const score = gameLog.events.filter(
    (event) => event.eventType === "shot" && event.event.goal,
  ).length;

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex max-w-[900px] flex-col gap-4">
        <NextLink
          className="link inline-flex items-center gap-2 self-start"
          href="/past-games"
        >
          <ArrowLeft className="size-4" />
          Back to past games
        </NextLink>

        <div>
          <Typography.Heading level={3}>
            {gameLog.game.homeTeamName}
          </Typography.Heading>
          <Typography.Paragraph color="muted" className="mt-2">
            Game #{gameLog.game.id} · {formatGameDate(gameLog.game.createdAt)}
          </Typography.Paragraph>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip color="success" variant="secondary">
            {score} goals
          </Chip>
          <Chip variant="secondary">{gameLog.events.length} logged events</Chip>
          <Chip variant="secondary">
            {gameLog.players.length} rostered players
          </Chip>
        </div>

        <PastGameCsvDownloadButton
          csv={csvPayload?.csv ?? ""}
          fileName={
            csvPayload?.fileName ?? `game-${gameLog.game.id}-player-events.csv`
          }
        />

        <PastGameEventLog events={gameLog.events} players={gameLog.players} />
      </div>
    </div>
  );
}
