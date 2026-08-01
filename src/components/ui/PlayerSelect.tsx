import { Label, ListBox, Select } from "@heroui/react";
import type { ClientId } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

interface PlayerOption {
  id: ClientId;
  number: number;
  name: string;
}

interface PlayerSelectProps {
  label: string;
  players: PlayerOption[];
  value: number | null;
  onChange: (value: number | null) => void;
  excludeNumber?: number | null;
  placeholder?: string;
}

export function PlayerSelect({
  label,
  players,
  value,
  onChange,
  excludeNumber = null,
  placeholder = "Select player",
}: PlayerSelectProps) {
  return (
    <Select
      fullWidth
      placeholder={placeholder}
      value={value?.toString() ?? null}
      onChange={(nextValue) => onChange(nextValue ? Number(nextValue) : null)}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {players.map((player) => (
            <ListBox.Item
              key={player.id}
              id={player.number.toString()}
              isDisabled={player.number === excludeNumber}
              textValue={formatPlayerLabel(player.number, [player])}
            >
              {formatPlayerLabel(player.number, [player])}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
