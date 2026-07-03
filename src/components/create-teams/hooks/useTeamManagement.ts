"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo, useState } from "react";
import {
  quickSubPairsCollection,
  teamPlayersCollection,
  teamsCollection,
} from "@/collections";
import type { QuickSubPair, Team, TeamPlayer } from "@/datamodel";
import { useNextLocalId } from "@/hooks/useNextLocalId";

export function useTeamManagement() {
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

  const nextTeamId = useNextLocalId(lastTeam);
  const nextPlayerId = useNextLocalId(lastPlayer);
  const nextQuickSubPairId = useNextLocalId(lastQuickSubPair);

  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addPlayerTeamId, setAddPlayerTeamId] = useState<number | null>(null);
  const [addQuickSubTeamId, setAddQuickSubTeamId] = useState<number | null>(
    null,
  );

  const normalizedTeamNames = useMemo(
    () => new Set(teams.data.map((team) => team.name.trim().toLowerCase())),
    [teams.data],
  );

  const existingPlayerNumbersForSelectedTeam = useMemo(
    () =>
      new Set(
        teamPlayers.data
          .filter((player) => player.teamId === addPlayerTeamId)
          .map((player) => player.number),
      ),
    [addPlayerTeamId, teamPlayers.data],
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

  return {
    addPlayerTeamId,
    addQuickSubTeamId,
    createTeamOpen,
    existingPlayerNumbersForSelectedTeam,
    handleAddPlayer,
    handleAddQuickSubPair,
    handleCreateTeam,
    handleDeletePlayer,
    handleDeleteQuickSubPair,
    handleDeleteTeam,
    normalizedTeamNames,
    quickSubPairs,
    setAddPlayerTeamId,
    setAddQuickSubTeamId,
    setCreateTeamOpen,
    teamPlayers,
    teams,
  };
}
