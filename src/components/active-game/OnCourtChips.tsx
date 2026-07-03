import { Chip, Typography } from "@heroui/react";
import { AlertCallout, AlertCalloutButton } from "@/components/ui/AlertCallout";
import type { TeamPlayer } from "@/datamodel";

interface OnCourtChipsProps {
  activePlayerNumbers: Set<number>;
  selectedTeamPlayers: TeamPlayer[];
}

export function OnCourtChips({
  activePlayerNumbers,
  selectedTeamPlayers,
}: OnCourtChipsProps) {
  return (
    <div className="mx-auto my-2 w-full max-w-[400px]">
      <Typography.Paragraph color="muted" className="mb-2 font-bold">
        On Court ({activePlayerNumbers.size})
      </Typography.Paragraph>
      <div className="flex flex-wrap gap-2">
        {Array.from(activePlayerNumbers).map((num) => {
          const player = selectedTeamPlayers.find(
            (teamPlayer) => teamPlayer.number === num,
          );
          return (
            <Chip key={num} color="accent" size="sm" variant="secondary">
              #{num} {player ? player.name.split(" ")[0] : ""}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

interface StartingLineupPromptProps {
  onSetStartingLineup: () => void;
}

export function StartingLineupPrompt({
  onSetStartingLineup,
}: StartingLineupPromptProps) {
  return (
    <AlertCallout
      className="mx-auto max-w-[400px]"
      variant="warning"
      action={
        <AlertCalloutButton onPress={onSetStartingLineup}>
          Set Starting Lineup
        </AlertCalloutButton>
      }
    >
      Starting lineup is not defined yet. Set the starting players to enable
      accurate tracking of who is on court.
    </AlertCallout>
  );
}
