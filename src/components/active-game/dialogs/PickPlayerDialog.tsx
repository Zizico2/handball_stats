import { ListSelectionModal } from "@/components/ui/ListSelectionModal";
import type { TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

interface PickPlayerDialogProps {
  players: TeamPlayer[];
  activePlayerNumbers: Set<number>;
  prioritizeActive?: boolean;
  selectionMode?: "all" | "onCourtOnly" | "benchOnly";
  open: boolean;
  title?: string;
  onPickPlayer: (pickedPlayer: number | null) => void;
}

export function PickPlayerDialog({
  players,
  activePlayerNumbers,
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
