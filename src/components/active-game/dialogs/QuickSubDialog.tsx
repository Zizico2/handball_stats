"use client";

import { Button, Chip, Separator, Typography } from "@heroui/react";
import { ArrowLeftRight } from "lucide-react";
import type { ActiveSuspension } from "@/components/active-game/utils/activeSuspensions";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
import type { QuickSubPair, TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";
import { filterQuickSubPairsForRoster } from "@/lib/quickSubPairs";

interface QuickSubDialogProps {
  open: boolean;
  pairs: QuickSubPair[];
  players: TeamPlayer[];
  activePlayerNumbers: Set<number>;
  activeSuspensions?: ActiveSuspension[];
  isSaving?: boolean;
  onQuickSub: (playerOut: number, playerIn: number) => void;
  onPickManually: () => void;
  onClose: () => void;
}

export function QuickSubDialog({
  open,
  pairs,
  players,
  activePlayerNumbers,
  activeSuspensions = [],
  isSaving = false,
  onQuickSub,
  onPickManually,
  onClose,
}: QuickSubDialogProps) {
  const getPlayerLabel = (num: number) => formatPlayerLabel(num, players);
  const getSuspensionCount = (num: number) =>
    activeSuspensions.filter(
      (suspension) =>
        suspension.offender === num || suspension.servedBy === num,
    ).length;
  const renderPlayerLabel = (num: number) => {
    const suspensionCount = getSuspensionCount(num);
    return (
      <span className="flex items-center gap-2">
        {suspensionCount > 0 ? (
          <Chip color="warning" size="sm" variant="soft">
            {suspensionCount > 1 ? `2 min ×${suspensionCount}` : "2 min"}
          </Chip>
        ) : null}
        {getPlayerLabel(num)}
      </span>
    );
  };
  const rosteredPairs = filterQuickSubPairsForRoster(pairs, players);

  return (
    <FullscreenModal isOpen={open} onClose={onClose} title="Substitution">
      {rosteredPairs.length > 0 && (
        <>
          <Typography.Paragraph color="muted" className="font-bold">
            Quick Substitutions
          </Typography.Paragraph>
          <div className="flex flex-col gap-3">
            {rosteredPairs.map((pair) => {
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

              const isDisabled = disabledReason !== null || isSaving;

              return (
                <Button
                  key={pair.id}
                  className="flex h-auto flex-col gap-1 rounded-2xl py-5"
                  isDisabled={isDisabled}
                  isPending={isSaving && disabledReason === null}
                  variant={disabledReason !== null ? "outline" : "primary"}
                  onPress={() => {
                    if (playerOut !== null && playerIn !== null && !isSaving) {
                      onQuickSub(playerOut, playerIn);
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-3">
                    <Typography.Paragraph
                      className={`font-bold ${disabledReason !== null ? "" : "text-danger"}`}
                    >
                      {renderPlayerLabel(pair.playerNumberA)}
                    </Typography.Paragraph>
                    <ArrowLeftRight className="size-4" />
                    <Typography.Paragraph
                      className={`font-bold ${disabledReason !== null ? "" : "text-success"}`}
                    >
                      {renderPlayerLabel(pair.playerNumberB)}
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
        isDisabled={isSaving}
        size="lg"
        variant="outline"
        onPress={onPickManually}
      >
        Pick players manually →
      </Button>
    </FullscreenModal>
  );
}
