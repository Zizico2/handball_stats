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
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { activeGameCollection, teamsCollection } from "@/collections";
import { useNewGameForm } from "@/components/new-game/hooks/useNewGameForm";
import { AlertCallout } from "@/components/ui/AlertCallout";

function NewGame() {
  const router = useRouter();
  const teams = useLiveSuspenseQuery((q) => q.from({ team: teamsCollection }));
  const activeGame = useLiveSuspenseQuery((q) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
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

  const { clearStartError, handleStartNewGame, isStarting, startError } =
    useNewGameForm({
      selectedTeamId,
      onStarted: () => router.push("/active-game"),
    });

  return (
    <div className="flex justify-center p-6">
      <div className="flex w-full max-w-[560px] flex-col gap-4">
        <Typography.Heading level={3}>New Game</Typography.Heading>
        {activeGame.data ? (
          <AlertCallout
            variant="danger"
            action={
              <NextLink
                className="link text-danger"
                href="/active-game"
                prefetch={false}
              >
                Go to Active Game
              </NextLink>
            }
          >
            Active game #{activeGame.data.gameId}
            {activeTeamName ? ` (${activeTeamName})` : ""} is currently in
            progress. You must end it before you can start a new game.
          </AlertCallout>
        ) : null}
        {startError ? (
          <AlertCallout variant="danger">{startError}</AlertCallout>
        ) : null}
        <Select
          fullWidth
          isDisabled={teams.data.length === 0 || isStarting}
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
              {teams.data.length === 0 ? (
                <ListBox.Item
                  id="none"
                  isDisabled
                  textValue="No teams available"
                >
                  No teams available
                </ListBox.Item>
              ) : (
                teams.data.map((team) => (
                  <ListBox.Item
                    key={team.id}
                    id={team.id.toString()}
                    textValue={team.name}
                  >
                    {team.name}
                  </ListBox.Item>
                ))
              )}
            </ListBox>
          </Select.Popover>
        </Select>
        <Tooltip isDisabled={!activeGame.data}>
          <Button
            className="w-full"
            isDisabled={
              selectedTeamId === null || !!activeGame.data || isStarting
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
            Cannot start a new game while an active game exists. End the active
            match first.
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}

export default NewGame;
