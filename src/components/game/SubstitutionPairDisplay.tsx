import { Chip } from "@heroui/react";
import { ArrowLeftRight } from "lucide-react";

interface SubstitutionPairDisplayProps {
  playerOutLabel: string;
  playerInLabel: string;
  disabled?: boolean;
}

export function SubstitutionPairDisplay({
  playerOutLabel,
  playerInLabel,
  disabled = false,
}: SubstitutionPairDisplayProps) {
  return (
    <>
      <Chip color="accent" size="sm" variant="secondary">
        {playerOutLabel}
      </Chip>
      <ArrowLeftRight className="size-4 text-muted" />
      <Chip color="accent" size="sm" variant="secondary">
        {playerInLabel}
      </Chip>
      {disabled ? null : (
        <span className="sr-only">
          {playerOutLabel} to {playerInLabel}
        </span>
      )}
    </>
  );
}
