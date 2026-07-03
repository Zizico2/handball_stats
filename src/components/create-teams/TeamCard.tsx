"use client";

import { Button, Separator, Surface, Typography } from "@heroui/react";
import { SubstitutionPairDisplay } from "@/components/game/SubstitutionPairDisplay";
import { RemovableListItem } from "@/components/ui/RemovableListItem";
import type { QuickSubPair, Team, TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

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
  return (
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
            onRemove={() => onDeletePlayer(player)}
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
  );
}
