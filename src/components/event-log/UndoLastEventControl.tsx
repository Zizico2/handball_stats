"use client";

import { AlertDialog, Button, Typography } from "@heroui/react";
import { useState } from "react";

interface UndoLastEventControlProps {
  disabled: boolean;
  eventLabel: string | null;
  onConfirmUndo: () => void;
}

export function UndoLastEventControl({
  disabled,
  eventLabel,
  onConfirmUndo,
}: UndoLastEventControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasEvent = eventLabel != null;

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Typography.Heading level={4} className="font-bold">
          Match Log
        </Typography.Heading>
        <Button
          isDisabled={disabled || !hasEvent}
          size="sm"
          variant="secondary"
          onPress={() => setIsOpen(true)}
        >
          {hasEvent ? `Undo: ${eventLabel}` : "Undo last event"}
        </Button>
      </div>

      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>Undo last event?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                This will remove{" "}
                <strong>{eventLabel ?? "the last event"}</strong> from the match
                log. Goal totals and on-court players will update
                automatically.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button
                slot="close"
                variant="danger"
                onPress={() => {
                  onConfirmUndo();
                }}
              >
                Undo event
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
