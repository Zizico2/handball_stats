"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { useAtomValue } from "jotai";
import { MoreVertical } from "lucide-react";
import { inGameControlsAtom } from "@/inGameControlsAtoms";

export default function ActiveGameMatchControlsMenu() {
  const inGameControls = useAtomValue(inGameControlsAtom);

  const disabledKeys = new Set<string>();

  if (
    inGameControls.matchStatus !== null ||
    inGameControls.disableStartFirstHalf ||
    inGameControls.isClockMutationPending
  ) {
    disabledKeys.add("start-first-half");
  }
  if (
    inGameControls.matchStatus !== "firstHalf" ||
    inGameControls.isClockMutationPending
  ) {
    disabledKeys.add("start-halftime");
  }
  if (
    inGameControls.matchStatus !== "halftime" ||
    inGameControls.disableStartSecondHalf ||
    inGameControls.isClockMutationPending
  ) {
    disabledKeys.add("start-second-half");
  }
  if (
    inGameControls.matchStatus === null ||
    inGameControls.matchStatus === "halftime" ||
    inGameControls.isClockMutationPending
  ) {
    disabledKeys.add("toggle-pause");
  }
  if (!inGameControls.hasActiveGame || inGameControls.isClockMutationPending) {
    disabledKeys.add("end-match");
  }

  return (
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
                inGameControls.onEndMatch();
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
          <Dropdown.Item id="end-match" textValue="End Match" variant="danger">
            <Label>End Match</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
