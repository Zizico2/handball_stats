"use client";

import { Button, Typography } from "@heroui/react";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import type { QuickSubPair, TeamPlayer } from "@/datamodel";

interface AddQuickSubPairDialogProps {
  existingPairs: QuickSubPair[];
  isOpen: boolean;
  onAdd: (numberA: number, numberB: number) => void;
  onCancel: () => void;
  players: TeamPlayer[];
}

export function AddQuickSubPairDialog({
  existingPairs,
  isOpen,
  onAdd,
  onCancel,
  players,
}: AddQuickSubPairDialogProps) {
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
      (pair) =>
        (pair.playerNumberA === playerA && pair.playerNumberB === playerB) ||
        (pair.playerNumberA === playerB && pair.playerNumberB === playerA),
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

      <PlayerSelect
        excludeNumber={playerB}
        label="Player A"
        players={players}
        value={playerA}
        onChange={setPlayerA}
      />

      <div className="flex justify-center">
        <ArrowLeftRight className="size-6 text-muted" />
      </div>

      <PlayerSelect
        excludeNumber={playerA}
        label="Player B"
        players={players}
        value={playerB}
        onChange={setPlayerB}
      />

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
