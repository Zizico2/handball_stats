"use client";

import type { ActiveSuspension } from "@/components/active-game/utils/activeSuspensions";
import { ListSelectionModal } from "@/components/ui/ListSelectionModal";
import type { ClientId } from "@/datamodel";

interface PickSuspensionToEndDialogProps {
  activeSuspensions: ActiveSuspension[];
  getPlayerLabel: (number: number) => string;
  open: boolean;
  onPick: (
    selection: { player: number; suspensionId: ClientId } | null,
  ) => void;
}

export function PickSuspensionToEndDialog({
  activeSuspensions,
  getPlayerLabel,
  open,
  onPick,
}: PickSuspensionToEndDialogProps) {
  return (
    <ListSelectionModal
      isOpen={open}
      options={activeSuspensions.map((suspension) => ({
        text: `${getPlayerLabel(suspension.offender)} — served by ${getPlayerLabel(suspension.servedBy)} — ${suspension.half === "firstHalf" ? "1st Half" : "2nd Half"} ${formatTime(suspension.ellapsedSeconds)}`,
        key: suspension.id,
        value: { player: suspension.offender, suspensionId: suspension.id },
      }))}
      title="End 2 Minute Suspension"
      onPickOption={onPick}
    />
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
