"use client";

import { Chip } from "@heroui/react";
import { useAtomValue } from "jotai";
import { matchSyncAtom } from "@/matchSyncAtom";

export function MatchSyncStatus() {
  const sync = useAtomValue(matchSyncAtom);

  if (sync.status === "idle") {
    return null;
  }

  const label =
    sync.status === "saving"
      ? "Saving…"
      : sync.status === "saved"
        ? "Saved"
        : "Failed";

  const color =
    sync.status === "saving"
      ? "accent"
      : sync.status === "saved"
        ? "success"
        : "danger";

  return (
    <Chip
      aria-live="polite"
      color={color}
      size="sm"
      variant="secondary"
      data-testid="match-sync-status"
      data-status={sync.status}
    >
      {label}
    </Chip>
  );
}
