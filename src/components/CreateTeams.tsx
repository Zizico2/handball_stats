"use client";
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Surface,
  TextField,
  Typography,
} from "@heroui/react";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import {
  quickSubPairsCollection,
  teamPlayersCollection,
  teamsCollection,
} from "@/collections";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
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
      <div className="h-full w-full">
        <div className="mx-auto flex w-fit flex-col gap-4">
          <Button variant="primary" onPress={() => setCreateTeamOpen(true)}>
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
              <Surface
                key={team.id}
                className="border border-separator p-3"
                variant="secondary"
              >
                <div className="flex items-center gap-2">
                  <Typography.Heading level={5}>{team.name}</Typography.Heading>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => handleDeleteTeam(team)}
                  >
                    Delete Team
                  </Button>
                </div>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onPress={() => setAddPlayerTeamId(team.id)}
                >
                  Add Player
                </Button>
                <div className="mt-2 flex flex-col gap-1">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <Typography.Paragraph>
                        #{player.number} {player.name}
                      </Typography.Paragraph>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => handleDeletePlayer(player)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="mb-2 flex items-center gap-2">
                  <Typography.Paragraph color="muted" className="font-bold">
                    Quick Sub Pairs
                  </Typography.Paragraph>
                  <Button
                    isDisabled={players.length < 2}
                    size="sm"
                    variant="outline"
                    onPress={() => setAddQuickSubTeamId(team.id)}
                  >
                    Add Pair
                  </Button>
                </div>
                {pairs.length === 0 ? (
                  <Typography.Paragraph color="muted" className="text-xs">
                    No quick sub pairs defined.
                  </Typography.Paragraph>
                ) : (
                  <div className="flex flex-col gap-1">
                    {pairs.map((pair) => {
                      const pA = players.find(
                        (p) => p.number === pair.playerNumberA,
                      );
                      const pB = players.find(
                        (p) => p.number === pair.playerNumberB,
                      );
                      return (
                        <div key={pair.id} className="flex items-center gap-2">
                          <Chip color="accent" size="sm" variant="secondary">
                            #{pair.playerNumberA} {pA?.name ?? ""}
                          </Chip>
                          <ArrowLeftRight className="size-4 text-muted" />
                          <Chip color="accent" size="sm" variant="secondary">
                            #{pair.playerNumberB} {pB?.name ?? ""}
                          </Chip>
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => handleDeleteQuickSubPair(pair)}
                          >
                            Remove
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Surface>
            );
          })}
        </div>
      </div>
      <CreateTeamDialog
        isOpen={createTeamOpen}
        existingTeamNames={normalizedTeamNames}
        onCreateTeam={handleCreateTeam}
        onCancel={() => setCreateTeamOpen(false)}
      />
      <AddPlayerDialog
        isOpen={addPlayerTeamId !== null}
        existingPlayerNumbers={existingPlayerNumbersForSelectedTeam}
        onAddPlayer={handleAddPlayer}
        onCancel={() => setAddPlayerTeamId(null)}
      />
      {addQuickSubTeamId !== null && (
        <AddQuickSubPairDialog
          isOpen
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
  isOpen,
  existingTeamNames,
  onCreateTeam,
  onCancel,
}: {
  isOpen: boolean;
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
    <FullscreenModal isOpen={isOpen} onClose={handleCancel} title="Create Team">
      <TextField
        fullWidth
        isInvalid={hasDuplicateName}
        value={name}
        onChange={setName}
      >
        <Label>Team Name</Label>
        <Input
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        {hasDuplicateName ? (
          <FieldError>Team name already exists</FieldError>
        ) : null}
      </TextField>
      <Button
        isDisabled={!trimmedName || hasDuplicateName}
        variant="primary"
        onPress={handleSubmit}
      >
        Create
      </Button>
    </FullscreenModal>
  );
}

function AddPlayerDialog({
  isOpen,
  existingPlayerNumbers,
  onAddPlayer,
  onCancel,
}: {
  isOpen: boolean;
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
    <FullscreenModal isOpen={isOpen} onClose={handleCancel} title="Add Player">
      <TextField fullWidth value={name} onChange={setName}>
        <Label>Player Name</Label>
        <Input autoFocus />
      </TextField>
      <TextField
        fullWidth
        isInvalid={hasDuplicateNumber}
        value={number}
        onChange={setNumber}
      >
        <Label>Player Number</Label>
        <Input
          type="number"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        {hasDuplicateNumber ? (
          <FieldError>Player number already exists on this team</FieldError>
        ) : null}
      </TextField>
      <Button isDisabled={!isValid} variant="primary" onPress={handleSubmit}>
        Add Player
      </Button>
    </FullscreenModal>
  );
}

function AddQuickSubPairDialog({
  isOpen,
  players,
  existingPairs,
  onAdd,
  onCancel,
}: {
  isOpen: boolean;
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
    <FullscreenModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Add Quick Sub Pair"
    >
      <Typography.Paragraph color="muted">
        Choose two players. In the active game you'll be able to swap them with
        one tap.
      </Typography.Paragraph>

      <Select
        fullWidth
        placeholder="Select player"
        value={playerA?.toString() ?? null}
        onChange={(value) => setPlayerA(value ? Number(value) : null)}
      >
        <Label>Player A</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {players.map((p) => (
              <ListBox.Item
                key={p.id}
                id={p.number.toString()}
                isDisabled={p.number === playerB}
                textValue={`#${p.number} ${p.name}`}
              >
                #{p.number} {p.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex justify-center">
        <ArrowLeftRight className="size-6 text-muted" />
      </div>

      <Select
        fullWidth
        placeholder="Select player"
        value={playerB?.toString() ?? null}
        onChange={(value) => setPlayerB(value ? Number(value) : null)}
      >
        <Label>Player B</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {players.map((p) => (
              <ListBox.Item
                key={p.id}
                id={p.number.toString()}
                isDisabled={p.number === playerA}
                textValue={`#${p.number} ${p.name}`}
              >
                #{p.number} {p.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {isDuplicate ? (
        <Typography.Paragraph color="muted" className="text-danger">
          This pair already exists.
        </Typography.Paragraph>
      ) : null}

      <Button isDisabled={!isValid} variant="primary" onPress={handleSubmit}>
        Add Pair
      </Button>
    </FullscreenModal>
  );
}
