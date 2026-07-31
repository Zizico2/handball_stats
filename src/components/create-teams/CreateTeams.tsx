"use client";

import { Button } from "@heroui/react";
import { AddPlayerDialog } from "@/components/create-teams/dialogs/AddPlayerDialog";
import { AddQuickSubPairDialog } from "@/components/create-teams/dialogs/AddQuickSubPairDialog";
import { CreateTeamDialog } from "@/components/create-teams/dialogs/CreateTeamDialog";
import { DeleteTeamDialog } from "@/components/create-teams/dialogs/DeleteTeamDialog";
import { useTeamManagement } from "@/components/create-teams/hooks/useTeamManagement";
import { TeamCard } from "@/components/create-teams/TeamCard";

function CreateTeams() {
  const {
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
  } = useTeamManagement();

  return (
    <>
      <div className="h-full w-full">
        <div className="mx-auto flex w-fit flex-col gap-4">
          <Button variant="primary" onPress={() => setCreateTeamOpen(true)}>
            Create Team
          </Button>
          {teams.data.map((team) => (
            <TeamCard
              key={team.id}
              pairs={quickSubPairs.data.filter(
                (pair) => pair.teamId === team.id,
              )}
              players={teamPlayers.data.filter(
                (player) => player.teamId === team.id,
              )}
              team={team}
              onAddPlayer={() => setAddPlayerTeamId(team.id)}
              onAddQuickSubPair={() => setAddQuickSubTeamId(team.id)}
              onDeletePlayer={handleDeletePlayer}
              onDeleteQuickSubPair={handleDeleteQuickSubPair}
              onDeleteTeam={() => requestDeleteTeam(team)}
            />
          ))}
        </div>
      </div>
      <CreateTeamDialog
        existingTeamNames={normalizedTeamNames}
        isOpen={createTeamOpen}
        onCancel={() => setCreateTeamOpen(false)}
        onCreateTeam={handleCreateTeam}
      />
      <AddPlayerDialog
        existingPlayerNumbers={existingPlayerNumbersForSelectedTeam}
        isOpen={addPlayerTeamId !== null}
        onAddPlayer={handleAddPlayer}
        onCancel={() => setAddPlayerTeamId(null)}
      />
      {addQuickSubTeamId !== null ? (
        <AddQuickSubPairDialog
          existingPairs={quickSubPairs.data.filter(
            (pair) => pair.teamId === addQuickSubTeamId,
          )}
          isOpen
          players={teamPlayers.data.filter(
            (player) => player.teamId === addQuickSubTeamId,
          )}
          onAdd={handleAddQuickSubPair}
          onCancel={() => setAddQuickSubTeamId(null)}
        />
      ) : null}
      <DeleteTeamDialog
        pairCount={
          teamDeletion
            ? quickSubPairs.data.filter(
                (pair) => pair.teamId === teamDeletion.team.id,
              ).length
            : 0
        }
        playerCount={
          teamDeletion
            ? teamPlayers.data.filter(
                (player) => player.teamId === teamDeletion.team.id,
              ).length
            : 0
        }
        status={teamDeletion?.status ?? "confirm"}
        team={teamDeletion?.team ?? null}
        onClose={closeDeleteTeam}
        onConfirm={() => {
          void handleDeleteTeam();
        }}
      />
    </>
  );
}

export default CreateTeams;
