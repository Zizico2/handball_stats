"use client";

import {
  Button,
  Label,
  ListBox,
  Select,
  Tooltip,
  Typography,
} from "@heroui/react";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  activeGameCollection,
  teamPlayersCollection,
  teamsCollection,
} from "@/collections";
import { AppNextLink } from "@/components/AppNextLink";
import { useNewGameForm } from "@/components/new-game/hooks/useNewGameForm";
import { AlertCallout, AlertCalloutButton } from "@/components/ui/AlertCallout";
import { MIN_ROSTER_SIZE } from "@/lib/roster/minRosterSize";

function NewGame() {
  const router = useRouter();
  const teams = useLiveSuspenseQuery((q) => q.from({ team: teamsCollection }));
  const teamPlayers = useLiveSuspenseQuery((q) =>
    q.from({ player: teamPlayersCollection }),
  );
  const activeGame = useLiveSuspenseQuery((q) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
  );

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const rosterCountByTeamId = useMemo(() => {
    const counts = new Map<number, number>();
    for (const player of teamPlayers.data) {
      counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
    }
    return counts;
  }, [teamPlayers.data]);

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

  const selectedRosterCount =
    selectedTeamId == null ? 0 : (rosterCountByTeamId.get(selectedTeamId) ?? 0);
  const selectedRosterReady = selectedRosterCount >= MIN_ROSTER_SIZE;
  const hasTeams = teams.data.length > 0;

  const { clearStartError, handleStartNewGame, isStarting, startError } =
    useNewGameForm({
      selectedTeamId,
      rosterReady: selectedRosterReady,
      onStarted: () => router.push("/active-game"),
    });

  return (
    <div className="flex justify-center p-6">
      <div className="flex w-full max-w-[560px] flex-col gap-4">
        <Typography.Heading level={3}>New Game</Typography.Heading>
        {!hasTeams ? (
          <AlertCallout
            variant="warning"
            action={
              <AppNextLink className="link" href="/create-teams">
                Create team
              </AppNextLink>
            }
          >
            You need a team before you can start a match.
          </AlertCallout>
        ) : null}
        {activeGame.data ? (
          <AlertCallout
            variant="danger"
            action={
              <AppNextLink className="link text-danger" href="/active-game">
                Go to Active Game
              </AppNextLink>
            }
          >
            Active game #{activeGame.data.gameId}
            {activeTeamName ? ` (${activeTeamName})` : ""} is currently in
            progress. You must end it before you can start a new game.
          </AlertCallout>
        ) : null}
        {startError ? (
          <div data-testid="match-sync-failure">
            <AlertCallout
              variant="danger"
              action={
                <AlertCalloutButton
                  onPress={() => {
                    void handleStartNewGame();
                  }}
                >
                  Retry
                </AlertCalloutButton>
              }
            >
              {startError}
            </AlertCallout>
          </div>
        ) : null}
        <Select
          fullWidth
          isDisabled={!hasTeams || isStarting}
          placeholder="Select a team"
          value={selectedTeamId?.toString() ?? null}
          onChange={(value) => {
            clearStartError();
            setSelectedTeamId(value ? Number(value) : null);
          }}
        >
          <Label>Home Team</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {!hasTeams ? (
                <ListBox.Item
                  id="none"
                  isDisabled
                  textValue="No teams available"
                >
                  No teams available
                </ListBox.Item>
              ) : (
                teams.data.map((team) => {
                  const rosterCount = rosterCountByTeamId.get(team.id) ?? 0;
                  const label = `${team.name} (${rosterCount} player${rosterCount === 1 ? "" : "s"})`;
                  return (
                    <ListBox.Item
                      key={team.id}
                      id={team.id.toString()}
                      textValue={label}
                    >
                      {label}
                    </ListBox.Item>
                  );
                })
              )}
            </ListBox>
          </Select.Popover>
        </Select>
        {hasTeams && selectedTeamId != null && !selectedRosterReady ? (
          <AlertCallout
            variant="warning"
            action={
              <AppNextLink className="link" href="/create-teams">
                Add players
              </AppNextLink>
            }
          >
            This team needs at least {MIN_ROSTER_SIZE} player
            {MIN_ROSTER_SIZE === 1 ? "" : "s"} before you can start a game.
          </AlertCallout>
        ) : null}
        <Tooltip
          isDisabled={
            !activeGame.data && selectedRosterReady && selectedTeamId != null
          }
        >
          <Button
            className="w-full"
            isDisabled={
              selectedTeamId === null ||
              !!activeGame.data ||
              !selectedRosterReady ||
              isStarting
            }
            isPending={isStarting}
            variant="primary"
            onPress={() => {
              void handleStartNewGame();
            }}
          >
            {({ isPending }) => (isPending ? "Starting…" : "Start Game")}
          </Button>
          <Tooltip.Content>
            {activeGame.data
              ? "Cannot start a new game while an active game exists. End the active match first."
              : !selectedRosterReady
                ? `Add at least ${MIN_ROSTER_SIZE} player${MIN_ROSTER_SIZE === 1 ? "" : "s"} to this team before starting.`
                : "Select a home team to start."}
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}

export default NewGame;
