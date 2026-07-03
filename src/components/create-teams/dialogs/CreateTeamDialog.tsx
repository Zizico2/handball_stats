"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { FullscreenModal } from "@/components/ui/FullscreenModal";

interface CreateTeamDialogProps {
  existingTeamNames: Set<string>;
  isOpen: boolean;
  onCancel: () => void;
  onCreateTeam: (name: string) => void;
}

export function CreateTeamDialog({
  existingTeamNames,
  isOpen,
  onCancel,
  onCreateTeam,
}: CreateTeamDialogProps) {
  const [name, setName] = useState("");

  const trimmedName = name.trim();
  const hasDuplicateName = existingTeamNames.has(trimmedName.toLowerCase());

  const handleSubmit = () => {
    if (!trimmedName || hasDuplicateName) return;
    onCreateTeam(trimmedName);
    setName("");
  };

  const handleCancel = () => {
    setName("");
    onCancel();
  };

  return (
    <FullscreenModal isOpen={isOpen} onClose={handleCancel} title="Create Team">
      <TextField
        fullWidth
        isInvalid={hasDuplicateName}
        value={name}
        onChange={setName}
      >
        <Label>Team Name</Label>
        <Input
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        {hasDuplicateName ? (
          <FieldError>Team name already exists</FieldError>
        ) : null}
      </TextField>
      <Button
        isDisabled={!trimmedName || hasDuplicateName}
        variant="primary"
        onPress={handleSubmit}
      >
        Create
      </Button>
    </FullscreenModal>
  );
}
