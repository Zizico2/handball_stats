"use client";

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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

    router.push("/in-game");
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
          <Typography variant="body2" color="text.secondary">
            Active game: #{activeGame.data.gameId}
            {activeTeamName ? ` (${activeTeamName})` : ""}. Starting a new one
            will replace it.
          </Typography>
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
        <Button
          variant="contained"
          onClick={handleStartNewGame}
          disabled={selectedTeamId === null}
        >
          Start Game
        </Button>
      </Box>
    </Box>
  );
}

export default NewGame;
