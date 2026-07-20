"use client";

import { AlertDialog, Button, Dropdown, Label } from "@heroui/react";
import { useAtomValue } from "jotai";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inGameControlsAtom } from "@/inGameControlsAtoms";
import { formatMatchPhase } from "@/lib/display/formatMatchPhase";
import { formatClockDigits } from "@/lib/display/formatMatchTime";
import { matchSyncAtom } from "@/matchSyncAtom";

export default function ActiveGameMatchControlsMenu() {
  const router = useRouter();
  const inGameControls = useAtomValue(inGameControlsAtom);
  const matchSync = useAtomValue(matchSyncAtom);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const hasUnresolvedMutation =
    matchSync.status === "saving" || matchSync.status === "failed";

  const disabledKeys = new Set<string>();

  if (
    inGameControls.matchStatus !== null ||
    inGameControls.disableStartFirstHalf ||
    inGameControls.isClockMutationPending ||
    hasUnresolvedMutation
  ) {
    disabledKeys.add("start-first-half");
  }
  if (
    inGameControls.matchStatus !== "firstHalf" ||
    inGameControls.isClockMutationPending ||
    hasUnresolvedMutation
  ) {
    disabledKeys.add("start-halftime");
  }
  if (
    inGameControls.matchStatus !== "halftime" ||
    inGameControls.disableStartSecondHalf ||
    inGameControls.isClockMutationPending ||
    hasUnresolvedMutation
  ) {
    disabledKeys.add("start-second-half");
  }
  if (
    inGameControls.matchStatus === null ||
    inGameControls.matchStatus === "halftime" ||
    inGameControls.isClockMutationPending ||
    hasUnresolvedMutation
  ) {
    disabledKeys.add("toggle-pause");
  }
  if (
    !inGameControls.hasActiveGame ||
    inGameControls.isClockMutationPending ||
    hasUnresolvedMutation ||
    isEnding
  ) {
    disabledKeys.add("end-match");
  }

  const clockLabel = formatClockDigits(
    inGameControls.clockMinutes,
    inGameControls.clockSeconds,
  );
  const phaseLabel = formatMatchPhase(inGameControls.matchStatus);

  return (
    <>
      <Dropdown>
        <Button isIconOnly aria-label="Match controls" variant="ghost">
          <MoreVertical className="size-5" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            disabledKeys={disabledKeys}
            onAction={(key) => {
              switch (key) {
                case "start-first-half":
                  inGameControls.onStartFirstHalf();
                  break;
                case "start-halftime":
                  inGameControls.onStartHalftime();
                  break;
                case "start-second-half":
                  inGameControls.onStartSecondHalf();
                  break;
                case "toggle-pause":
                  inGameControls.onTogglePause();
                  break;
                case "end-match":
                  setEndConfirmOpen(true);
                  break;
              }
            }}
          >
            <Dropdown.Item id="start-first-half" textValue="Start First Half">
              <Label>Start First Half</Label>
            </Dropdown.Item>
            <Dropdown.Item id="start-halftime" textValue="Start Halftime">
              <Label>Start Halftime</Label>
            </Dropdown.Item>
            <Dropdown.Item id="start-second-half" textValue="Start Second Half">
              <Label>Start Second Half</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="toggle-pause"
              textValue={
                inGameControls.isRunning ? "Pause Match" : "Resume Match"
              }
            >
              <Label>
                {inGameControls.isRunning ? "Pause Match" : "Resume Match"}
              </Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="end-match"
              textValue="End Match"
              variant="danger"
            >
              <Label>End Match</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <AlertDialog.Backdrop
        isOpen={endConfirmOpen}
        onOpenChange={(open) => {
          if (!isEnding) {
            setEndConfirmOpen(open);
          }
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[420px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>End this match?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                Ending{" "}
                <strong>{inGameControls.teamName ?? "this match"}</strong> moves
                it to Past Games. Live entry will stop.
              </p>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                <li>
                  Phase: <strong>{phaseLabel}</strong>
                </li>
                <li>
                  Clock: <strong>{clockLabel}</strong>
                </li>
                <li>
                  Goals: <strong>{inGameControls.goals}</strong>
                </li>
                <li>
                  Events: <strong>{inGameControls.eventCount}</strong>
                </li>
              </ul>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                autoFocus
                slot="close"
                variant="primary"
                isDisabled={isEnding}
              >
                Continue match
              </Button>
              <Button
                variant="danger"
                isDisabled={isEnding}
                isPending={isEnding}
                onPress={() => {
                  void (async () => {
                    setIsEnding(true);
                    const gameId = inGameControls.gameId;
                    const ended = await inGameControls.onEndMatch();
                    setIsEnding(false);
                    if (!ended) {
                      return;
                    }
                    setEndConfirmOpen(false);
                    if (gameId != null) {
                      router.push(`/past-games/${gameId}`);
                    }
                  })();
                }}
              >
                {({ isPending }) => (isPending ? "Ending…" : "End match")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
