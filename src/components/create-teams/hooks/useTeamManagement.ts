"use client";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo, useRef, useState } from "react";
import type { AppCollections } from "@/collections";
import {
  quickSubPairsLiveQuery,
  teamPlayersLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import type { ClientId, QuickSubPair, Team, TeamPlayer } from "@/datamodel";
import { createClientId } from "@/lib/clientId";
import { quickSubPairReferencesPlayer } from "@/lib/quickSubPairs";
import { TeamHasGamesError } from "@/server/api/teamDeletionErrors";
import { useAppCollections } from "@/useAppCollections";

export type TeamDeletionStatus = "confirm" | "pending" | "blocked" | "error";

export interface TeamDeletionState {
  status: TeamDeletionStatus;
  team: Team;
}

function evictDeletedTeamSetup(collections: AppCollections, teamId: ClientId) {
  // The API deletes these rows atomically; writeDelete also updates cached queries.
  const playerIds = collections.teamPlayersCollection.toArray
    .filter((player) => player.teamId === teamId && player.$synced)
    .map((player) => player.id);
  const pairIds = collections.quickSubPairsCollection.toArray
    .filter((pair) => pair.teamId === teamId && pair.$synced)
    .map((pair) => pair.id);

  if (playerIds.length > 0) {
    collections.teamPlayersCollection.utils.writeDelete(playerIds);
  }
  if (pairIds.length > 0) {
    collections.quickSubPairsCollection.utils.writeDelete(pairIds);
  }
}

export function useTeamManagement() {
  const collections = useAppCollections();
  const teams = useLiveSuspenseQuery(teamsLiveQuery);

  const teamPlayers = useLiveSuspenseQuery(teamPlayersLiveQuery);

  const quickSubPairs = useLiveSuspenseQuery(quickSubPairsLiveQuery);

  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addPlayerTeamId, setAddPlayerTeamId] = useState<ClientId | null>(null);
  const [addQuickSubTeamId, setAddQuickSubTeamId] = useState<ClientId | null>(
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

    collections.teamsCollection.insert({
      id: createClientId(),
      name: name.trim(),
    });
    setCreateTeamOpen(false);
  };

  const handleAddPlayer = (name: string, number: number) => {
    if (addPlayerTeamId === null) return;

    if (existingPlayerNumbersForSelectedTeam.has(number)) {
      return;
    }

    collections.teamPlayersCollection.insert({
      id: createClientId(),
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
    teamId: ClientId,
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
      const transaction = collections.teamsCollection.delete(team.id);
      await transaction.isPersisted.promise;
      evictDeletedTeamSetup(collections, team.id);
      setTeamDeletion(null);
    } catch (error) {
      try {
        await collections.teamsCollection.utils.refetch({ throwOnError: true });
      } catch (reconciliationError) {
        console.error("Failed to reconcile team deletion", reconciliationError);
        updateTeamDeletionStatus(
          team.id,
          error instanceof TeamHasGamesError ? "blocked" : "error",
        );
        return;
      }

      if (collections.teamsCollection.get(team.id) === undefined) {
        evictDeletedTeamSetup(collections, team.id);
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
      collections.quickSubPairsCollection.delete(pair.id);
    }
    collections.teamPlayersCollection.delete(player.id);
  };

  const handleAddQuickSubPair = (numberA: number, numberB: number) => {
    if (addQuickSubTeamId === null) return;
    collections.quickSubPairsCollection.insert({
      id: createClientId(),
      teamId: addQuickSubTeamId,
      playerNumberA: numberA,
      playerNumberB: numberB,
    });
    setAddQuickSubTeamId(null);
  };

  const handleDeleteQuickSubPair = (pair: QuickSubPair) => {
    collections.quickSubPairsCollection.delete(pair.id);
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
