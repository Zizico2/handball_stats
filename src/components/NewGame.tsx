"use client";

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  activeGameCollection,
  gamesCollection,
  teamsCollection,
} from "@/collections";

function NewGame() {
  const router = useRouter();

  const teams = useLiveSuspenseQuery((q) => q.from({ team: teamsCollection }));

  const activeGame = useLiveSuspenseQuery((q) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
  );

  const lastGame = useLiveSuspenseQuery((q) =>
    q
      .from({ game: gamesCollection })
      .orderBy(({ game }) => game.id, "desc")
      .findOne(),
  );

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  useEffect(() => {
    if (teams.data.length === 0) {
      setSelectedTeamId(null);
      return;
    }

    const selectedTeamStillExists = teams.data.some(
      (team) => team.id === selectedTeamId,
    );

    if (!selectedTeamStillExists) {
      setSelectedTeamId(teams.data[0].id);
    }
  }, [selectedTeamId, teams.data]);

  const activeTeamName = useMemo(() => {
    const activeGameData = activeGame.data;

    if (!activeGameData) {
      return null;
    }

    return (
      teams.data.find((team) => team.id === activeGameData.homeTeamId)?.name ??
      null
    );
  }, [activeGame.data, teams.data]);

  const handleStartNewGame = () => {
    if (selectedTeamId === null) {
      return;
    }

    const nextGameId = (lastGame.data?.id ?? 0) + 1;

    gamesCollection.insert({
      id: nextGameId,
      homeTeamId: selectedTeamId,
      createdAt: new Date().toISOString(),
      firstHalfStartedAtMs: null,
      secondHalfStartedAtMs: null,
    });

    if (activeGame.data) {
      activeGameCollection.delete(activeGame.data.id);
    }

    activeGameCollection.insert({
      id: 1,
      gameId: nextGameId,
      homeTeamId: selectedTeamId,
    });

    router.push("/active-game");
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
      <Box
        sx={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h4">New Game</Typography>
        {activeGame.data ? (
          // TODO: refactor this into a separate component. It is also used in "active game" when a starting 7 hasn't been set.
          <Box
            sx={{
              bgcolor: "rgba(211, 47, 47, 0.08)",
              border: "1px solid",
              borderColor: "rgba(211, 47, 47, 0.3)",
              borderRadius: 2,
              p: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Typography
              variant="body2"
              color="error.main"
              sx={{ fontWeight: "medium", textAlign: "center" }}
            >
              Active game #{activeGame.data.gameId}
              {activeTeamName ? ` (${activeTeamName})` : ""} is currently in
              progress. You must end it before you can start a new game.
            </Typography>
            <Button
              href="/active-game"
              variant="outlined"
              color="error"
              size="small"
            >
              Go to Active Game
            </Button>
          </Box>
        ) : null}
        <FormControl fullWidth disabled={teams.data.length === 0}>
          <InputLabel id="home-team-select-label">Home Team</InputLabel>
          <Select
            labelId="home-team-select-label"
            label="Home Team"
            value={selectedTeamId?.toString() ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTeamId(value === "" ? null : Number(value));
            }}
          >
            {teams.data.length === 0 ? (
              <MenuItem value="">No teams available</MenuItem>
            ) : (
              teams.data.map((team) => (
                <MenuItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
        <Tooltip
          title={
            activeGame.data
              ? "Cannot start a new game while an active game exists. End the active match first."
              : ""
          }
          arrow
        >
          <span style={{ display: "block", width: "100%" }}>
            <Button
              variant="contained"
              onClick={handleStartNewGame}
              disabled={selectedTeamId === null || !!activeGame.data}
              fullWidth
            >
              Start Game
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default NewGame;
