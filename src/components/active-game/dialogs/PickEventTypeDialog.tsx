import { ListSelectionModal } from "@/components/ui/ListSelectionModal";
import type { EventGroup, EventType } from "@/datamodel";

const EVENT_TYPE_OPTIONS: Record<
  EventGroup,
  Array<{ text: string; key: string; value: EventType }>
> = {
  attack: [
    { text: "Shot", key: "shot", value: "shot" },
    {
      text: "Offensive Foul",
      key: "offensiveFoul",
      value: "offensiveFoul",
    },
    { text: "Provoked 7meter", key: "provoked7meter", value: "provoked7meter" },
    { text: "Provoked 2min", key: "provoked2min", value: "provoked2min" },
    { text: "Travelling", key: "travelling", value: "travelling" },
    { text: "Dribble Fault", key: "dribbleFault", value: "dribbleFault" },
    { text: "Forcing", key: "forcing", value: "forcing" },
    { text: "Lost Ball", key: "lostBall", value: "lostBall" },
  ],
  defense: [
    { text: "Shot", key: "shot", value: "shot" },
    { text: "Interception", key: "interception", value: "interception" },
    {
      text: "7 Meter Conceded",
      key: "sevenMeterConceded",
      value: "sevenMeterConceded",
    },
    { text: "1-on-1 Lost", key: "oneOnOneLost", value: "oneOnOneLost" },
    { text: "Blocked Shot", key: "blockedShot", value: "blockedShot" },
    {
      text: "Offensive Foul Provoked",
      key: "offensiveFoul",
      value: "offensiveFoul",
    },
  ],
  sanction: [
    { text: "Red Card", key: "redCard", value: "redCard" },
    { text: "Yellow Card", key: "yellowCard", value: "yellowCard" },
    {
      text: "2 Minute Suspension",
      key: "twoMinuteSuspension",
      value: "twoMinuteSuspension",
    },
    {
      text: "End 2 Minute Suspension",
      key: "twoMinuteSuspensionEnded",
      value: "twoMinuteSuspensionEnded",
    },
  ],
  substitution: [],
};

const EVENT_GROUP_TITLES: Record<EventGroup, string> = {
  attack: "Pick Attack Event Type",
  defense: "Pick Defense Event Type",
  sanction: "Pick Sanction Event Type",
  substitution: "Pick Substitution Event Type",
};

interface PickEventTypeDialogProps {
  disabledEventTypes?: ReadonlySet<EventType>;
  group: EventGroup;
  open: boolean;
  onPickEventType: (eventType: EventType | null) => void;
}

export function PickEventTypeDialog({
  disabledEventTypes = new Set(),
  group,
  open,
  onPickEventType,
}: PickEventTypeDialogProps) {
  return (
    <ListSelectionModal
      isOpen={open}
      options={EVENT_TYPE_OPTIONS[group].map((option) => ({
        ...option,
        disabled: disabledEventTypes.has(option.value),
      }))}
      title={EVENT_GROUP_TITLES[group]}
      onPickOption={onPickEventType}
    />
  );
}
