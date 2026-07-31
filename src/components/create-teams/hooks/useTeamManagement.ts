"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo, useRef, useState } from "react";
import {
  quickSubPairsCollection,
  teamPlayersCollection,
  teamsCollection,
} from "@/collections";
import type { QuickSubPair, Team, TeamPlayer } from "@/datamodel";
import { useNextLocalId } from "@/hooks/useNextLocalId";
import { quickSubPairReferencesPlayer } from "@/lib/quickSubPairs";
import { TeamHasGamesError } from "@/server/api/teamDeletionErrors";

export type TeamDeletionStatus = "confirm" | "pending" | "blocked" | "error";

export interface TeamDeletionState {
  status: TeamDeletionStatus;
  team: Team;
}

function evictDeletedTeamSetup(teamId: number) {
  // The API deletes these rows atomically; writeDelete also updates cached queries.
  const playerIds = teamPlayersCollection.toArray
    .filter((player) => player.teamId === teamId && player.$synced)
    .map((player) => player.id);
  const pairIds = quickSubPairsCollection.toArray
    .filter((pair) => pair.teamId === teamId && pair.$synced)
    .map((pair) => pair.id);

  if (playerIds.length > 0) {
    teamPlayersCollection.utils.writeDelete(playerIds);
  }
  if (pairIds.length > 0) {
    quickSubPairsCollection.utils.writeDelete(pairIds);
  }
}

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
  const [teamDeletion, setTeamDeletion] = useState<TeamDeletionState | null>(
    null,
  );
  const teamDeletionPendingRef = useRef(false);

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

  const requestDeleteTeam = (team: Team) => {
    if (teamDeletionPendingRef.current) return;
    setTeamDeletion({ status: "confirm", team });
  };

  const closeDeleteTeam = () => {
    if (teamDeletionPendingRef.current) return;
    setTeamDeletion(null);
  };

  const updateTeamDeletionStatus = (
    teamId: number,
    status: TeamDeletionStatus,
  ) => {
    setTeamDeletion((current) =>
      current?.team.id === teamId ? { ...current, status } : current,
    );
  };

  const handleDeleteTeam = async () => {
    if (!teamDeletion || teamDeletionPendingRef.current) return;

    const { team } = teamDeletion;
    teamDeletionPendingRef.current = true;
    updateTeamDeletionStatus(team.id, "pending");

    try {
      const transaction = teamsCollection.delete(team.id);
      await transaction.isPersisted.promise;
      evictDeletedTeamSetup(team.id);
      setTeamDeletion(null);
    } catch (error) {
      try {
        await teamsCollection.utils.refetch({ throwOnError: true });
      } catch (reconciliationError) {
        console.error("Failed to reconcile team deletion", reconciliationError);
        updateTeamDeletionStatus(
          team.id,
          error instanceof TeamHasGamesError ? "blocked" : "error",
        );
        return;
      }

      if (teamsCollection.get(team.id) === undefined) {
        evictDeletedTeamSetup(team.id);
        setTeamDeletion(null);
      } else {
        updateTeamDeletionStatus(
          team.id,
          error instanceof TeamHasGamesError ? "blocked" : "error",
        );
      }
    } finally {
      teamDeletionPendingRef.current = false;
    }
  };

  const handleDeletePlayer = (player: TeamPlayer) => {
    for (const pair of quickSubPairs.data.filter((candidate) =>
      quickSubPairReferencesPlayer(candidate, player),
    )) {
      quickSubPairsCollection.delete(pair.id);
    }
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
    closeDeleteTeam,
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
    requestDeleteTeam,
    setAddPlayerTeamId,
    setAddQuickSubTeamId,
    setCreateTeamOpen,
    teamPlayers,
    teamDeletion,
    teams,
  };
}
