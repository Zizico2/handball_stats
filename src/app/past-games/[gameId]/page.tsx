import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
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
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
      <Stack spacing={2} sx={{ maxWidth: 900 }}>
        <Button
          href="/past-games"
          startIcon={<ArrowBackIcon />}
          sx={{ alignSelf: "flex-start" }}
        >
          Back to past games
        </Button>

        <Box>
          <Typography variant="h4">{gameLog.game.homeTeamName}</Typography>
          <Typography
            sx={{
              color: "text.secondary",
              mt: 1,
            }}
          >
            Game #{gameLog.game.id} · {formatGameDate(gameLog.game.createdAt)}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Chip label={`${score} goals`} color="success" />
          <Chip label={`${gameLog.events.length} logged events`} />
          <Chip
            label={`${gameLog.players.length} rostered players`}
            variant="outlined"
          />
        </Stack>

        <PastGameCsvDownloadButton
          csv={csvPayload?.csv ?? ""}
          fileName={
            csvPayload?.fileName ?? `game-${gameLog.game.id}-player-events.csv`
          }
        />

        <PastGameEventLog events={gameLog.events} players={gameLog.players} />
      </Stack>
    </Box>
  );
}
