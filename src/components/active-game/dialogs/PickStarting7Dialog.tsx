"use client";

import { Button, Checkbox, Modal, Typography } from "@heroui/react";
import { useState } from "react";
import type { TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

interface PickStarting7DialogProps {
  open: boolean;
  players: TeamPlayer[];
  currentStartingNumbers: number[];
  onSave: (numbers: number[]) => void;
  onClose: () => void;
}

export function PickStarting7Dialog({
  open,
  players,
  currentStartingNumbers,
  onSave,
  onClose,
}: PickStarting7DialogProps) {
  const [selected, setSelected] = useState<number[]>(currentStartingNumbers);

  const handleToggle = (number: number) => {
    setSelected((prev) =>
      prev.includes(number)
        ? prev.filter((n) => n !== number)
        : [...prev, number],
    );
  };

  const targetCount = Math.min(7, players.length);
  const isValid = selected.length === targetCount;

  return (
    <Modal.Backdrop
      isOpen={open}
      isDismissable={false}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Define Starting Lineup</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Typography.Paragraph color="muted">
              Select {targetCount} starting players.
              {selected.length !== targetCount &&
                ` (Currently selected: ${selected.length})`}
            </Typography.Paragraph>

            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-separator">
              {players.map((player) => {
                const isChecked = selected.includes(player.number);
                return (
                  <div
                    key={player.number}
                    className="px-3 py-2 hover:bg-surface-secondary"
                  >
                    <Checkbox
                      isSelected={isChecked}
                      onChange={() => handleToggle(player.number)}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        {formatPlayerLabel(player.number, [player])}
                      </Checkbox.Content>
                    </Checkbox>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button
                isDisabled={!isValid}
                variant="primary"
                onPress={() => onSave(selected)}
              >
                Save Lineup
              </Button>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
