"use client";

import { Button, Separator, Typography } from "@heroui/react";
import { ArrowLeftRight } from "lucide-react";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
import type { QuickSubPair, TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

interface QuickSubDialogProps {
  open: boolean;
  pairs: QuickSubPair[];
  players: TeamPlayer[];
  activePlayerNumbers: Set<number>;
  onQuickSub: (playerOut: number, playerIn: number) => void;
  onPickManually: () => void;
  onClose: () => void;
}

export function QuickSubDialog({
  open,
  pairs,
  players,
  activePlayerNumbers,
  onQuickSub,
  onPickManually,
  onClose,
}: QuickSubDialogProps) {
  const getPlayerLabel = (num: number) => formatPlayerLabel(num, players);

  return (
    <FullscreenModal isOpen={open} onClose={onClose} title="Substitution">
      {pairs.length > 0 && (
        <>
          <Typography.Paragraph color="muted" className="font-bold">
            Quick Substitutions
          </Typography.Paragraph>
          <div className="flex flex-col gap-3">
            {pairs.map((pair) => {
              const aOnCourt = activePlayerNumbers.has(pair.playerNumberA);
              const bOnCourt = activePlayerNumbers.has(pair.playerNumberB);

              let playerOut: number | null = null;
              let playerIn: number | null = null;
              let disabledReason: string | null = null;

              if (aOnCourt && bOnCourt) {
                disabledReason = "Both on court";
              } else if (!aOnCourt && !bOnCourt) {
                disabledReason = "Both on bench";
              } else if (aOnCourt) {
                playerOut = pair.playerNumberA;
                playerIn = pair.playerNumberB;
              } else {
                playerOut = pair.playerNumberB;
                playerIn = pair.playerNumberA;
              }

              const isDisabled = disabledReason !== null;

              return (
                <Button
                  key={pair.id}
                  className="flex h-auto flex-col gap-1 rounded-2xl py-5"
                  isDisabled={isDisabled}
                  variant={isDisabled ? "outline" : "primary"}
                  onPress={() => {
                    if (playerOut !== null && playerIn !== null) {
                      onQuickSub(playerOut, playerIn);
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-3">
                    <Typography.Paragraph
                      className={`font-bold ${isDisabled ? "" : "text-danger"}`}
                    >
                      {getPlayerLabel(pair.playerNumberA)}
                    </Typography.Paragraph>
                    <ArrowLeftRight className="size-4" />
                    <Typography.Paragraph
                      className={`font-bold ${isDisabled ? "" : "text-success"}`}
                    >
                      {getPlayerLabel(pair.playerNumberB)}
                    </Typography.Paragraph>
                  </div>
                  {disabledReason ? (
                    <Typography.Paragraph color="muted" className="text-xs">
                      {disabledReason}
                    </Typography.Paragraph>
                  ) : null}
                  {!disabledReason &&
                  playerOut !== null &&
                  playerIn !== null ? (
                    <Typography.Paragraph
                      color="muted"
                      className="text-xs opacity-85"
                    >
                      {getPlayerLabel(playerOut)} out /{" "}
                      {getPlayerLabel(playerIn)} in
                    </Typography.Paragraph>
                  ) : null}
                </Button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <Typography.Paragraph color="muted" className="text-xs">
              or
            </Typography.Paragraph>
            <Separator className="flex-1" />
          </div>
        </>
      )}
      <Button
        className="rounded-2xl py-4"
        size="lg"
        variant="outline"
        onPress={onPickManually}
      >
        Pick players manually →
      </Button>
    </FullscreenModal>
  );
}
