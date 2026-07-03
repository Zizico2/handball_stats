import { Button } from "@heroui/react";
import { ArrowLeftRight, Bolt, Shield, TriangleAlert } from "lucide-react";
import type { EventGroup } from "@/datamodel";

interface EventGroupButtonsProps {
  onRecordEvent: (group: EventGroup) => void;
  disabled: boolean;
}

export function EventGroupButtons({
  onRecordEvent,
  disabled,
}: EventGroupButtonsProps) {
  return (
    <div className="mt-2 w-full">
      <div className="grid grid-cols-2 gap-4">
        <Button
          className="h-auto bg-warning py-3 text-warning-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("attack")}
        >
          <Bolt className="size-4" />
          Attack
        </Button>
        <Button
          className="h-auto bg-accent py-3 text-accent-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("defense")}
        >
          <Shield className="size-4" />
          Defense
        </Button>
        <Button
          className="h-auto bg-danger py-3 text-danger-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("sanction")}
        >
          <TriangleAlert className="size-4" />
          Sanction
        </Button>
        <Button
          className="h-auto bg-success py-3 text-success-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("substitution")}
        >
          <ArrowLeftRight className="size-4" />
          Substitution
        </Button>
      </div>
    </div>
  );
}
