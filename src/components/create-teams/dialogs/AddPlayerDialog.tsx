"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { FullscreenModal } from "@/components/ui/FullscreenModal";

interface AddPlayerDialogProps {
  existingPlayerNumbers: Set<number>;
  isOpen: boolean;
  onAddPlayer: (name: string, number: number) => void;
  onCancel: () => void;
}

export function AddPlayerDialog({
  existingPlayerNumbers,
  isOpen,
  onAddPlayer,
  onCancel,
}: AddPlayerDialogProps) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");

  const trimmedName = name.trim();
  const parsedNumber = Number.parseInt(number, 10);
  const hasDuplicateNumber = existingPlayerNumbers.has(parsedNumber);

  const handleSubmit = () => {
    if (!trimmedName || Number.isNaN(parsedNumber) || hasDuplicateNumber) {
      return;
    }

    onAddPlayer(trimmedName, parsedNumber);
    setName("");
    setNumber("");
  };

  const handleCancel = () => {
    setName("");
    setNumber("");
    onCancel();
  };

  const isValid =
    trimmedName !== "" && !Number.isNaN(parsedNumber) && !hasDuplicateNumber;

  return (
    <FullscreenModal isOpen={isOpen} onClose={handleCancel} title="Add Player">
      <TextField fullWidth value={name} onChange={setName}>
        <Label>Player Name</Label>
        <Input autoFocus />
      </TextField>
      <TextField
        fullWidth
        isInvalid={hasDuplicateNumber}
        value={number}
        onChange={setNumber}
      >
        <Label>Player Number</Label>
        <Input
          type="number"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        {hasDuplicateNumber ? (
          <FieldError>Player number already exists on this team</FieldError>
        ) : null}
      </TextField>
      <Button isDisabled={!isValid} variant="primary" onPress={handleSubmit}>
        Add Player
      </Button>
    </FullscreenModal>
  );
}
