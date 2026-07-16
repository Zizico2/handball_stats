"use client";

import { useAtomValue } from "jotai";
import { AlertCallout, AlertCalloutButton } from "@/components/ui/AlertCallout";
import { matchSyncAtom } from "@/matchSyncAtom";

export function MatchSyncFailureCallout() {
  const sync = useAtomValue(matchSyncAtom);

  if (sync.status !== "failed" || sync.message === null) {
    return null;
  }

  return (
    <div data-testid="match-sync-failure">
      <AlertCallout
        variant="danger"
        action={
          sync.retry ? (
            <AlertCalloutButton onPress={sync.retry}>Retry</AlertCalloutButton>
          ) : undefined
        }
      >
        {sync.message}
      </AlertCallout>
    </div>
  );
}
