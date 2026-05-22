import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HistoryIcon from "@mui/icons-material/History";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
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
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <HistoryIcon color="action" />
          <Typography variant="h4">Past Games</Typography>
        </Stack>
        <Typography
          sx={{
            color: "text.secondary",
          }}
        >
          Open any finished game to inspect its event log.
        </Typography>
      </Stack>
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        {games.length === 0 ? (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6">No past games yet</Typography>
              <Typography
                sx={{
                  color: "text.secondary",
                  mt: 1,
                }}
              >
                Start and replace an active game to build up match history here.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          games.map((game) => (
            <Card key={game.id} variant="outlined">
              <CardActionArea href={`/past-games/${game.id}`}>
                <CardContent>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { xs: "flex-start", sm: "center" },
                    }}
                  >
                    <Box>
                      <Typography variant="h6">{game.homeTeamName}</Typography>
                      <Typography
                        sx={{
                          color: "text.secondary",
                          mt: 0.5,
                        }}
                      >
                        Game #{game.id} · {formatGameDate(game.createdAt)}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Chip label={`${game.score} goals`} color="success" />
                      <Chip
                        label={`${game.eventCount} events`}
                        variant="outlined"
                      />
                      <ChevronRightIcon color="action" />
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))
        )}
      </Stack>
    </Box>
  );
}
