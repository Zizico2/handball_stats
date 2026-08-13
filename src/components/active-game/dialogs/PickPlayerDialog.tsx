import { Chip } from "@heroui/react";
import type { ActiveSuspension } from "@/components/active-game/utils/activeSuspensions";
import { ListSelectionModal } from "@/components/ui/ListSelectionModal";
import type { TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

interface PickPlayerDialogProps {
  players: TeamPlayer[];
  activePlayerNumbers: Set<number>;
  activeSuspensions?: ActiveSuspension[];
  prioritizeActive?: boolean;
  selectionMode?: "all" | "onCourtOnly" | "benchOnly";
  open: boolean;
  title?: string;
  onPickPlayer: (pickedPlayer: number | null) => void;
}

export function PickPlayerDialog({
  players,
  activePlayerNumbers,
  activeSuspensions = [],
  prioritizeActive = true,
  selectionMode = "all",
  open,
  title = "Pick a Player",
  onPickPlayer,
}: PickPlayerDialogProps) {
  const hasStartingLineup = activePlayerNumbers.size > 0;

  const sortedPlayers = [...players].sort((a, b) => {
    if (hasStartingLineup) {
      const aActive = activePlayerNumbers.has(a.number);
      const bActive = activePlayerNumbers.has(b.number);
      if (aActive && !bActive) return prioritizeActive ? -1 : 1;
      if (!aActive && bActive) return prioritizeActive ? 1 : -1;
    }
    return a.number - b.number;
  });

  return (
    <ListSelectionModal
      isOpen={open}
      options={sortedPlayers.map((player) => ({
        text: formatPlayerLabel(player.number, [player]),
        label: (
          <span className="flex items-center gap-2">
            {(() => {
              const suspensionCount = activeSuspensions.filter(
                (suspension) =>
                  suspension.offender === player.number ||
                  suspension.servedBy === player.number,
              ).length;
              return suspensionCount > 0 ? (
                <Chip color="warning" size="sm" variant="soft">
                  {suspensionCount > 1 ? `2 min ×${suspensionCount}` : "2 min"}
                </Chip>
              ) : null;
            })()}
            <span>{formatPlayerLabel(player.number, [player])}</span>
          </span>
        ),
        key: `${player.number}`,
        value: player.number,
        disabled:
          selectionMode === "onCourtOnly"
            ? !activePlayerNumbers.has(player.number)
            : selectionMode === "benchOnly"
              ? activePlayerNumbers.has(player.number)
              : false,
        group: hasStartingLineup
          ? activePlayerNumbers.has(player.number)
            ? "On Court"
            : "Bench"
          : undefined,
      }))}
      title={title}
      onPickOption={onPickPlayer}
    />
  );
}
