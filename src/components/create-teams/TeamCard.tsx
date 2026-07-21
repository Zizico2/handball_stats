"use client";

import {
  AlertDialog,
  Button,
  Separator,
  Surface,
  Typography,
} from "@heroui/react";
import { useState } from "react";
import { SubstitutionPairDisplay } from "@/components/game/SubstitutionPairDisplay";
import { RemovableListItem } from "@/components/ui/RemovableListItem";
import type { QuickSubPair, Team, TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";
import { quickSubPairReferencesPlayer } from "@/lib/quickSubPairs";

interface TeamCardProps {
  onAddPlayer: () => void;
  onAddQuickSubPair: () => void;
  onDeletePlayer: (player: TeamPlayer) => void;
  onDeleteQuickSubPair: (pair: QuickSubPair) => void;
  onDeleteTeam: () => void;
  pairs: QuickSubPair[];
  players: TeamPlayer[];
  team: Team;
}

export function TeamCard({
  onAddPlayer,
  onAddQuickSubPair,
  onDeletePlayer,
  onDeleteQuickSubPair,
  onDeleteTeam,
  pairs,
  players,
  team,
}: TeamCardProps) {
  const [playerPendingDeletion, setPlayerPendingDeletion] =
    useState<TeamPlayer | null>(null);

  const affectedPairCount = playerPendingDeletion
    ? pairs.filter((pair) =>
        quickSubPairReferencesPlayer(pair, playerPendingDeletion),
      ).length
    : 0;

  const requestPlayerDeletion = (player: TeamPlayer) => {
    const affectsQuickSubPairs = pairs.some((pair) =>
      quickSubPairReferencesPlayer(pair, player),
    );

    if (affectsQuickSubPairs) {
      setPlayerPendingDeletion(player);
      return;
    }

    onDeletePlayer(player);
  };

  return (
    <>
      <Surface className="border border-separator p-3" variant="secondary">
        <div className="flex items-center gap-2">
          <Typography.Heading level={5}>{team.name}</Typography.Heading>
          <Button size="sm" variant="outline" onPress={onDeleteTeam}>
            Delete Team
          </Button>
        </div>
        <Button
          className="mt-2"
          size="sm"
          variant="outline"
          onPress={onAddPlayer}
        >
          Add Player
        </Button>
        <div className="mt-2 flex flex-col gap-1">
          {players.map((player) => (
            <RemovableListItem
              key={player.id}
              onRemove={() => requestPlayerDeletion(player)}
            >
              {formatPlayerLabel(player.number, [player])}
            </RemovableListItem>
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
            onPress={onAddQuickSubPair}
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
              const playerA = players.find(
                (player) => player.number === pair.playerNumberA,
              );
              const playerB = players.find(
                (player) => player.number === pair.playerNumberB,
              );

              return (
                <div key={pair.id} className="flex items-center gap-2">
                  <SubstitutionPairDisplay
                    playerInLabel={formatPlayerLabel(
                      pair.playerNumberB,
                      playerB ? [playerB] : undefined,
                    )}
                    playerOutLabel={formatPlayerLabel(
                      pair.playerNumberA,
                      playerA ? [playerA] : undefined,
                    )}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => onDeleteQuickSubPair(pair)}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Surface>

      <AlertDialog.Backdrop
        isOpen={playerPendingDeletion !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPlayerPendingDeletion(null);
          }
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Remove this player?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                Removing{" "}
                <strong>
                  {playerPendingDeletion
                    ? formatPlayerLabel(playerPendingDeletion.number, [
                        playerPendingDeletion,
                      ])
                    : "this player"}
                </strong>{" "}
                will also remove {affectedPairCount} quick-sub{" "}
                {affectedPairCount === 1 ? "pair" : "pairs"}.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  if (playerPendingDeletion) {
                    onDeletePlayer(playerPendingDeletion);
                    setPlayerPendingDeletion(null);
                  }
                }}
              >
                Remove player and pairs
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
