"use client";
import CloseIcon from "@mui/icons-material/Close";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import dynamic from "next/dynamic";
import { useState } from "react";
import { teamsCollection, teamPlayersCollection } from "@/collections";
import type { Team, TeamPlayer } from "@/datamodel";

function CreateTeams() {
  const teams = useLiveSuspenseQuery((q) =>
    q.from({ team: teamsCollection }),
  );

  const teamPlayers = useLiveSuspenseQuery((q) =>
    q.from({ player: teamPlayersCollection }),
  );

  const lastTeam = useLiveSuspenseQuery((q) =>
    q
      .from({ team: teamsCollection })
      .orderBy(({ team }) => team.id, "desc")
      .findOne(),
  );

  const lastPlayer = useLiveSuspenseQuery((q) =>
    q
      .from({ player: teamPlayersCollection })
      .orderBy(({ player }) => player.id, "desc")
      .findOne(),
  );

  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addPlayerTeamId, setAddPlayerTeamId] = useState<number | null>(null);

  const nextTeamId = (lastTeam.data?.id ?? 0) + 1;
  const nextPlayerId = (lastPlayer.data?.id ?? 0) + 1;

  const normalizedTeamNames = new Set(
    teams.data.map((team) => team.name.trim().toLowerCase()),
  );

  const existingPlayerNumbersForSelectedTeam = new Set(
    teamPlayers.data
      .filter((player) => player.teamId === addPlayerTeamId)
      .map((player) => player.number),
  );

  const handleCreateTeam = (name: string) => {
    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName || normalizedTeamNames.has(normalizedName)) {
      return;
    }

    teamsCollection.insert({ id: nextTeamId, name: name.trim() });
    setCreateTeamOpen(false);
  };

  const handleAddPlayer = (name: string, number: number) => {
    if (addPlayerTeamId === null) return;

    if (existingPlayerNumbersForSelectedTeam.has(number)) {
      return;
    }

    teamPlayersCollection.insert({
      id: nextPlayerId,
      teamId: addPlayerTeamId,
      name: name.trim(),
      number,
    });
    setAddPlayerTeamId(null);
  };

  const handleDeleteTeam = (team: Team) => {
    for (const player of teamPlayers.data.filter((p) => p.teamId === team.id)) {
      teamPlayersCollection.delete(player.id);
    }
    teamsCollection.delete(team.id);
  };

  const handleDeletePlayer = (player: TeamPlayer) => {
    teamPlayersCollection.delete(player.id);
  };

  return (
    <>
      <Box sx={{ height: "100%", width: "100%" }}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexDirection: "column",
            margin: "auto",
            width: "fit-content",
          }}
        >
          <Button variant="contained" onClick={() => setCreateTeamOpen(true)}>
            Create Team
          </Button>
          {teams.data.map((team) => (
            <Box key={team.id} sx={{ border: "1px solid black", padding: 1 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Typography variant="h6">{team.name}</Typography>
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  onClick={() => handleDeleteTeam(team)}
                >
                  Delete Team
                </Button>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setAddPlayerTeamId(team.id)}
              >
                Add Player
              </Button>
              <Box sx={{ marginTop: 1 }}>
                {teamPlayers.data
                  .filter((p) => p.teamId === team.id)
                  .map((player) => (
                    <Box
                      key={player.id}
                      sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                        padding: "2px 0",
                      }}
                    >
                      <div>
                        #{player.number} {player.name}
                      </div>
                      <Button
                        color="error"
                        variant="outlined"
                        size="small"
                        onClick={() => handleDeletePlayer(player)}
                      >
                        Remove
                      </Button>
                    </Box>
                  ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
      <CreateTeamDialog
        open={createTeamOpen}
        existingTeamNames={normalizedTeamNames}
        onCreateTeam={handleCreateTeam}
        onCancel={() => setCreateTeamOpen(false)}
      />
      <AddPlayerDialog
        open={addPlayerTeamId !== null}
        existingPlayerNumbers={existingPlayerNumbersForSelectedTeam}
        onAddPlayer={handleAddPlayer}
        onCancel={() => setAddPlayerTeamId(null)}
      />
    </>
  );
}

export default dynamic(() => Promise.resolve(CreateTeams), {
  ssr: false,
});

function CreateTeamDialog({
  open,
  existingTeamNames,
  onCreateTeam,
  onCancel,
}: {
  open: boolean;
  existingTeamNames: Set<string>;
  onCreateTeam: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  const trimmedName = name.trim();
  const hasDuplicateName = existingTeamNames.has(trimmedName.toLowerCase());

  const handleSubmit = () => {
    if (!trimmedName || hasDuplicateName) return;
    onCreateTeam(trimmedName);
    setName("");
  };

  const handleCancel = () => {
    setName("");
    onCancel();
  };

  return (
    <Dialog fullScreen open={open}>
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleCancel}
            aria-label="cancel"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Create Team
          </Typography>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Team Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            error={hasDuplicateName}
            helperText={hasDuplicateName ? "Team name already exists" : undefined}
            autoFocus
          />
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!trimmedName || hasDuplicateName}
          >
            Create
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function AddPlayerDialog({
  open,
  existingPlayerNumbers,
  onAddPlayer,
  onCancel,
}: {
  open: boolean;
  existingPlayerNumbers: Set<number>;
  onAddPlayer: (name: string, number: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");

  const trimmedName = name.trim();
  const parsedNumber = Number.parseInt(number, 10);
  const hasDuplicateNumber = existingPlayerNumbers.has(parsedNumber);

  const handleSubmit = () => {
    if (!trimmedName || Number.isNaN(parsedNumber) || hasDuplicateNumber) {
      return;
    }

    onAddPlayer(trimmedName, parsedNumber);
    setName("");
    setNumber("");
  };

  const handleCancel = () => {
    setName("");
    setNumber("");
    onCancel();
  };

  const isValid =
    trimmedName !== "" &&
    !Number.isNaN(parsedNumber) &&
    !hasDuplicateNumber;

  return (
    <Dialog fullScreen open={open}>
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleCancel}
            aria-label="cancel"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Add Player
          </Typography>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Player Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <TextField
            label="Player Number"
            type="number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            error={hasDuplicateNumber}
            helperText={
              hasDuplicateNumber ? "Player number already exists on this team" : undefined
            }
          />
          <Button variant="contained" onClick={handleSubmit} disabled={!isValid}>
            Add Player
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
