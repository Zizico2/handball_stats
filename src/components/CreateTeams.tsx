"use client";
import CloseIcon from "@mui/icons-material/Close";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useState } from "react";
import {
  quickSubPairsCollection,
  teamPlayersCollection,
  teamsCollection,
} from "@/collections";
import type { QuickSubPair, Team, TeamPlayer } from "@/datamodel";

function CreateTeams() {
  const teams = useLiveSuspenseQuery((q) => q.from({ team: teamsCollection }));

  const teamPlayers = useLiveSuspenseQuery((q) =>
    q.from({ player: teamPlayersCollection }),
  );

  const quickSubPairs = useLiveSuspenseQuery((q) =>
    q.from({ pair: quickSubPairsCollection }),
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

  const lastQuickSubPair = useLiveSuspenseQuery((q) =>
    q
      .from({ pair: quickSubPairsCollection })
      .orderBy(({ pair }) => pair.id, "desc")
      .findOne(),
  );

  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addPlayerTeamId, setAddPlayerTeamId] = useState<number | null>(null);
  const [addQuickSubTeamId, setAddQuickSubTeamId] = useState<number | null>(
    null,
  );

  const nextTeamId = (lastTeam.data?.id ?? 0) + 1;
  const nextPlayerId = (lastPlayer.data?.id ?? 0) + 1;
  const nextQuickSubPairId = (lastQuickSubPair.data?.id ?? 0) + 1;

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
    for (const pair of quickSubPairs.data.filter((p) => p.teamId === team.id)) {
      quickSubPairsCollection.delete(pair.id);
    }
    teamsCollection.delete(team.id);
  };

  const handleDeletePlayer = (player: TeamPlayer) => {
    teamPlayersCollection.delete(player.id);
  };

  const handleAddQuickSubPair = (numberA: number, numberB: number) => {
    if (addQuickSubTeamId === null) return;
    quickSubPairsCollection.insert({
      id: nextQuickSubPairId,
      teamId: addQuickSubTeamId,
      playerNumberA: numberA,
      playerNumberB: numberB,
    });
    setAddQuickSubTeamId(null);
  };

  const handleDeleteQuickSubPair = (pair: QuickSubPair) => {
    quickSubPairsCollection.delete(pair.id);
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
          {teams.data.map((team) => {
            const players = teamPlayers.data.filter(
              (p) => p.teamId === team.id,
            );
            const pairs = quickSubPairs.data.filter(
              (p) => p.teamId === team.id,
            );

            return (
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

                {/* Players section */}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setAddPlayerTeamId(team.id)}
                >
                  Add Player
                </Button>
                <Box sx={{ marginTop: 1 }}>
                  {players.map((player) => (
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

                {/* Quick Sub Pairs section */}
                <Divider sx={{ my: 1.5 }} />
                <Box
                  sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}
                >
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color="text.secondary"
                  >
                    Quick Sub Pairs
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={players.length < 2}
                    onClick={() => setAddQuickSubTeamId(team.id)}
                  >
                    Add Pair
                  </Button>
                </Box>
                {pairs.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    No quick sub pairs defined.
                  </Typography>
                ) : (
                  <Stack spacing={0.5}>
                    {pairs.map((pair) => {
                      const pA = players.find(
                        (p) => p.number === pair.playerNumberA,
                      );
                      const pB = players.find(
                        (p) => p.number === pair.playerNumberB,
                      );
                      return (
                        <Box
                          key={pair.id}
                          sx={{ display: "flex", gap: 1, alignItems: "center" }}
                        >
                          <Chip
                            size="small"
                            label={`#${pair.playerNumberA} ${pA?.name ?? ""}`}
                            variant="outlined"
                            color="primary"
                          />
                          <SwapHorizIcon fontSize="small" color="action" />
                          <Chip
                            size="small"
                            label={`#${pair.playerNumberB} ${pB?.name ?? ""}`}
                            variant="outlined"
                            color="primary"
                          />
                          <Button
                            color="error"
                            variant="outlined"
                            size="small"
                            onClick={() => handleDeleteQuickSubPair(pair)}
                          >
                            Remove
                          </Button>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            );
          })}
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
      {addQuickSubTeamId !== null && (
        <AddQuickSubPairDialog
          open={true}
          players={teamPlayers.data.filter(
            (p) => p.teamId === addQuickSubTeamId,
          )}
          existingPairs={quickSubPairs.data.filter(
            (p) => p.teamId === addQuickSubTeamId,
          )}
          onAdd={handleAddQuickSubPair}
          onCancel={() => setAddQuickSubTeamId(null)}
        />
      )}
    </>
  );
}

export default CreateTeams;

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
          <input
            type="text"
            placeholder="Team Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            style={{ fontSize: 16, padding: 8 }}
          />
          {hasDuplicateName && (
            <Typography color="error" variant="caption">
              Team name already exists
            </Typography>
          )}
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
    trimmedName !== "" && !Number.isNaN(parsedNumber) && !hasDuplicateNumber;

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
          <input
            type="text"
            placeholder="Player Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{ fontSize: 16, padding: 8 }}
          />
          <input
            type="number"
            placeholder="Player Number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{ fontSize: 16, padding: 8 }}
          />
          {hasDuplicateNumber && (
            <Typography color="error" variant="caption">
              Player number already exists on this team
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!isValid}
          >
            Add Player
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function AddQuickSubPairDialog({
  open,
  players,
  existingPairs,
  onAdd,
  onCancel,
}: {
  open: boolean;
  players: TeamPlayer[];
  existingPairs: QuickSubPair[];
  onAdd: (numberA: number, numberB: number) => void;
  onCancel: () => void;
}) {
  const [playerA, setPlayerA] = useState<number | null>(null);
  const [playerB, setPlayerB] = useState<number | null>(null);

  const handleCancel = () => {
    setPlayerA(null);
    setPlayerB(null);
    onCancel();
  };

  const isDuplicate =
    playerA !== null &&
    playerB !== null &&
    existingPairs.some(
      (p) =>
        (p.playerNumberA === playerA && p.playerNumberB === playerB) ||
        (p.playerNumberA === playerB && p.playerNumberB === playerA),
    );

  const isValid =
    playerA !== null && playerB !== null && playerA !== playerB && !isDuplicate;

  const handleSubmit = () => {
    if (!isValid || playerA === null || playerB === null) return;
    onAdd(playerA, playerB);
    setPlayerA(null);
    setPlayerB(null);
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
            Add Quick Sub Pair
          </Typography>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Choose two players. In-game you'll be able to swap them with one
            tap.
          </Typography>

          <FormControl fullWidth>
            <InputLabel id="player-a-label">Player A</InputLabel>
            <Select
              labelId="player-a-label"
              value={playerA ?? ""}
              label="Player A"
              onChange={(e) => setPlayerA(e.target.value as number)}
            >
              {players.map((p) => (
                <MenuItem
                  key={p.id}
                  value={p.number}
                  disabled={p.number === playerB}
                >
                  #{p.number} {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <SwapHorizIcon color="action" fontSize="large" />
          </Box>

          <FormControl fullWidth>
            <InputLabel id="player-b-label">Player B</InputLabel>
            <Select
              labelId="player-b-label"
              value={playerB ?? ""}
              label="Player B"
              onChange={(e) => setPlayerB(e.target.value as number)}
            >
              {players.map((p) => (
                <MenuItem
                  key={p.id}
                  value={p.number}
                  disabled={p.number === playerA}
                >
                  #{p.number} {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isDuplicate && (
            <Typography color="error" variant="caption">
              This pair already exists.
            </Typography>
          )}

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!isValid}
          >
            Add Pair
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
