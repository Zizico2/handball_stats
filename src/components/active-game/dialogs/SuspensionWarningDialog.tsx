"use client";

import { AlertDialog, Button, Typography } from "@heroui/react";
import type { ActiveSuspension } from "@/components/active-game/utils/activeSuspensions";

interface SuspensionWarningDialogProps {
  getPlayerLabel: (number: number) => string;
  isBlocked?: boolean;
  isEnding?: boolean;
  onCancel: () => void;
  onContinue: () => void;
  onEndAndContinue?: (suspension: ActiveSuspension) => void;
  open: boolean;
  playerLabel: string;
  suspensions: ActiveSuspension[];
}

export function SuspensionWarningDialog({
  getPlayerLabel,
  isBlocked = false,
  isEnding = false,
  onCancel,
  onContinue,
  onEndAndContinue,
  open,
  playerLabel,
  suspensions,
}: SuspensionWarningDialogProps) {
  return (
    <AlertDialog.Backdrop
      isOpen={open}
      isDismissable={false}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isEnding) {
          onCancel();
        }
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[440px]">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>
              Player has an active suspension
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <Typography.Paragraph>
              {playerLabel} is linked to an active 2 minute suspension. Do you
              want to record this event anyway?
            </Typography.Paragraph>
            <div className="flex flex-col gap-2 rounded-xl bg-surface-secondary p-3">
              {suspensions.map((suspension) => (
                <div key={suspension.id} className="flex flex-col gap-1">
                  <Typography.Paragraph className="font-medium">
                    {getPlayerLabel(suspension.offender)}
                  </Typography.Paragraph>
                  <Typography.Paragraph color="muted" className="text-sm">
                    Served by {getPlayerLabel(suspension.servedBy)} ·{" "}
                    {suspension.half === "firstHalf" ? "1st Half" : "2nd Half"}{" "}
                    {formatTime(suspension.ellapsedSeconds)}
                  </Typography.Paragraph>
                  {onEndAndContinue ? (
                    <Button
                      isDisabled={isEnding || isBlocked}
                      isPending={isEnding}
                      size="sm"
                      variant="outline"
                      onPress={() => onEndAndContinue(suspension)}
                    >
                      End suspension & continue
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button isDisabled={isEnding} variant="tertiary" onPress={onCancel}>
              Cancel
            </Button>
            <Button
              isDisabled={isEnding || isBlocked}
              variant="primary"
              onPress={onContinue}
            >
              Continue anyway
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
