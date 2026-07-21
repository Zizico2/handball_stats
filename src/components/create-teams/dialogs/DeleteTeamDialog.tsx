"use client";

import { AlertDialog, Button } from "@heroui/react";
import type { TeamDeletionStatus } from "@/components/create-teams/hooks/useTeamManagement";
import type { Team } from "@/datamodel";

interface DeleteTeamDialogProps {
  pairCount: number;
  playerCount: number;
  status: TeamDeletionStatus;
  team: Team | null;
  onClose: () => void;
  onConfirm: () => void;
}

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function DeleteTeamDialog({
  pairCount,
  playerCount,
  status,
  team,
  onClose,
  onConfirm,
}: DeleteTeamDialogProps) {
  const isPending = status === "pending";
  const isBlocked = status === "blocked";
  const isError = status === "error";

  return (
    <AlertDialog.Backdrop
      isOpen={team !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          {!isPending ? <AlertDialog.CloseTrigger /> : null}
          <AlertDialog.Header>
            <AlertDialog.Icon status={isError ? "warning" : "danger"} />
            <AlertDialog.Heading>
              {isBlocked
                ? "Team can’t be deleted"
                : isError
                  ? "Team deletion failed"
                  : "Delete this team?"}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            {isBlocked ? (
              <p>
                <strong>{team?.name ?? "This team"}</strong> has match history,
                so it must remain available for past-game statistics.
              </p>
            ) : isError ? (
              <p>
                The team could not be deleted. Check your connection and try
                again.
              </p>
            ) : (
              <>
                <p>
                  Deleting <strong>{team?.name ?? "this team"}</strong> also
                  removes its current roster and quick-sub setup. This action
                  cannot be undone.
                </p>
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  <li>
                    Team: <strong>1</strong>
                  </li>
                  <li>
                    Players:{" "}
                    <strong>{countLabel(playerCount, "player")}</strong>
                  </li>
                  <li>
                    Quick-sub pairs:{" "}
                    <strong>{countLabel(pairCount, "pair")}</strong>
                  </li>
                </ul>
              </>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            {isBlocked ? (
              <Button autoFocus variant="primary" onPress={onClose}>
                Close
              </Button>
            ) : isError ? (
              <>
                <Button variant="tertiary" onPress={onClose}>
                  Close
                </Button>
                <Button variant="danger" onPress={onConfirm}>
                  Try again
                </Button>
              </>
            ) : (
              <>
                <Button
                  autoFocus
                  isDisabled={isPending}
                  variant="tertiary"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  isDisabled={isPending}
                  isPending={isPending}
                  variant="danger"
                  onPress={onConfirm}
                >
                  {({ isPending: buttonPending }) =>
                    buttonPending ? "Deleting…" : "Delete team"
                  }
                </Button>
              </>
            )}
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
