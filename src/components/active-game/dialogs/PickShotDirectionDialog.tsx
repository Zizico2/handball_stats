import { Button, Typography } from "@heroui/react";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
import type { ShotAim, ShotDirectionFields } from "@/datamodel";
import { shotAimSchema } from "@/datamodel";

const SHOT_AIM_LABELS: Record<ShotAim, string> = {
  TopLeft: "Top left",
  TopCenter: "Top center",
  TopRight: "Top right",
  MiddleLeft: "Middle left",
  MiddleCenter: "Middle center",
  MiddleRight: "Middle right",
  BottomLeft: "Bottom left",
  BottomCenter: "Bottom center",
  BottomRight: "Bottom right",
};

interface PickShotDirectionDialogProps {
  open: boolean;
  onPick: (pick: ShotDirectionFields | null) => void;
}

export function PickShotDirectionDialog({
  open,
  onPick,
}: PickShotDirectionDialogProps) {
  return (
    <FullscreenModal
      isOpen={open}
      onClose={() => onPick(null)}
      title="Shot target"
    >
      <Typography.Paragraph color="muted" className="text-center">
        Tap the zone on the goal. Handball goals are wider than they are
        tall—this frame matches that shape.
      </Typography.Paragraph>
      <div className="w-full max-w-[380px] self-center">
        <div className="mb-1 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onPress={() => onPick({ direction: "OnTarget" })}
          >
            On target
          </Button>
        </div>
        <div className="aspect-[3/2] w-full rounded-lg border-[3px] border-accent bg-surface-secondary p-1.5">
          <div className="grid h-full grid-cols-3 gap-1">
            {shotAimSchema.options.map((aim) => (
              <Button
                key={aim}
                aria-label={SHOT_AIM_LABELS[aim]}
                className="h-full min-h-[52px] text-[0.7rem] leading-tight shadow-none"
                variant="secondary"
                onPress={() => onPick({ direction: "OnTarget", aim })}
              >
                {SHOT_AIM_LABELS[aim]}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex w-full max-w-[380px] flex-col gap-2 self-center sm:flex-row">
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onPick({ direction: "OffTarget" })}
        >
          Off target
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onPick({ direction: "Blocked" })}
        >
          Blocked
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onPick({ direction: "Post" })}
        >
          Post
        </Button>
      </div>
    </FullscreenModal>
  );
}
