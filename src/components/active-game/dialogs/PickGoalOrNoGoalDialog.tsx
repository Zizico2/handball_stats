import { ListSelectionModal } from "@/components/ui/ListSelectionModal";

interface PickGoalOrNoGoalDialogProps {
  open: boolean;
  onPickGoalOrNoGoal: (goal: boolean | null) => void;
}

export function PickGoalOrNoGoalDialog({
  open,
  onPickGoalOrNoGoal,
}: PickGoalOrNoGoalDialogProps) {
  return (
    <ListSelectionModal
      isOpen={open}
      options={[
        { text: "Goal", key: "goal", value: true },
        { text: "No Goal", key: "no_goal", value: false },
      ]}
      title="Was it a Goal?"
      onPickOption={onPickGoalOrNoGoal}
    />
  );
}
