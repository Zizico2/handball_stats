import { ListSelectionModal } from "@/components/ui/ListSelectionModal";
import type { ShotPosition } from "@/datamodel";
import { shotPosition } from "@/datamodel";

interface PickShotPositionDialogProps {
  open: boolean;
  onPickShotPosition: (position: ShotPosition | null) => void;
}

export function PickShotPositionDialog({
  open,
  onPickShotPosition,
}: PickShotPositionDialogProps) {
  return (
    <ListSelectionModal
      isOpen={open}
      options={shotPosition.options.map((option) => ({
        text: option,
        key: option,
        value: option,
      }))}
      title="Pick Shot Position"
      onPickOption={onPickShotPosition}
    />
  );
}
