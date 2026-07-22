"use client";

import { Button, Checkbox, Modal, Typography } from "@heroui/react";
import { useState } from "react";
import { resolveInitialStartingSelection } from "@/components/active-game/utils/resolveInitialStartingSelection";
import type { TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

interface PickStarting7DialogProps {
  open: boolean;
  players: TeamPlayer[];
  currentStartingNumbers: number[];
  activePlayerNumbers: Set<number>;
  isSaving?: boolean;
  onSave: (numbers: number[]) => void;
  onClose: () => void;
}

export function PickStarting7Dialog({
  open,
  players,
  currentStartingNumbers,
  activePlayerNumbers,
  isSaving = false,
  onSave,
  onClose,
}: PickStarting7DialogProps) {
  const [selected, setSelected] = useState(() =>
    resolveInitialStartingSelection(
      currentStartingNumbers,
      activePlayerNumbers,
      new Set(players.map((player) => player.number)),
    ),
  );

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
                  <Checkbox
                    key={player.number}
                    className="w-full"
                    isSelected={isChecked}
                    onChange={() => handleToggle(player.number)}
                  >
                    <Checkbox.Content className="w-full px-3 py-2 hover:bg-surface-secondary">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      {formatPlayerLabel(player.number, [player])}
                    </Checkbox.Content>
                  </Checkbox>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <Button isDisabled={isSaving} variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button
                isDisabled={!isValid || isSaving}
                isPending={isSaving}
                variant="primary"
                onPress={() => onSave(selected)}
              >
                {({ isPending }) => (isPending ? "Saving…" : "Save Lineup")}
              </Button>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
