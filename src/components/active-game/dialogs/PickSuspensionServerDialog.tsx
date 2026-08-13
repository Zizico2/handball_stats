"use client";

import {
  Button,
  Chip,
  Label,
  ListBox,
  Select,
  Typography,
} from "@heroui/react";
import { useState } from "react";
import type { ActiveSuspension } from "@/components/active-game/utils/activeSuspensions";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
import type { Player, TeamPlayer } from "@/datamodel";
import { formatPlayerLabel } from "@/lib/display/formatPlayerLabel";

interface PickSuspensionServerDialogProps {
  activePlayerNumbers: Set<number>;
  activeSuspensions: ActiveSuspension[];
  offender: Player;
  open: boolean;
  players: TeamPlayer[];
  onPickServer: (player: Player | null) => void;
}

export function PickSuspensionServerDialog({
  activePlayerNumbers,
  activeSuspensions,
  offender,
  open,
  players,
  onPickServer,
}: PickSuspensionServerDialogProps) {
  const onCourtPlayers = players.filter((player) =>
    activePlayerNumbers.has(player.number),
  );
  const offenderOnCourt = activePlayerNumbers.has(offender);
  const defaultServer = offenderOnCourt ? offender : null;

  const [selectedServer, setSelectedServer] = useState<number | null>(
    defaultServer,
  );

  return (
    <FullscreenModal
      isOpen={open}
      onClose={() => onPickServer(null)}
      title="Who Serves the 2 Minute Suspension?"
    >
      {!offenderOnCourt ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <Typography.Paragraph className="font-medium text-warning">
            {formatPlayerLabel(offender, players)} is on the bench. Choose an
            on-court player who will serve this suspension.
          </Typography.Paragraph>
        </div>
      ) : (
        <Typography.Paragraph color="muted">
          The offender is selected by default. Change this only when another
          on-court player will serve the suspension.
        </Typography.Paragraph>
      )}

      <Select
        fullWidth
        isRequired
        placeholder="Select serving player"
        value={selectedServer?.toString() ?? null}
        onChange={(value) =>
          setSelectedServer(value === null ? null : Number(value))
        }
      >
        <Label>Serving player</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {onCourtPlayers.map((player) => {
              const suspensionCount = activeSuspensions.filter(
                (suspension) =>
                  suspension.offender === player.number ||
                  suspension.servedBy === player.number,
              ).length;
              return (
                <ListBox.Item
                  key={player.id}
                  id={player.number.toString()}
                  textValue={formatPlayerLabel(player.number, [player])}
                >
                  <span className="flex items-center gap-2">
                    {suspensionCount > 0 ? (
                      <Chip color="warning" size="sm" variant="soft">
                        {suspensionCount > 1
                          ? `2 min ×${suspensionCount}`
                          : "2 min"}
                      </Chip>
                    ) : null}
                    {formatPlayerLabel(player.number, [player])}
                  </span>
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      <Button
        isDisabled={selectedServer === null}
        variant="primary"
        onPress={() => {
          if (selectedServer !== null) {
            onPickServer(selectedServer);
          }
        }}
      >
        Save suspension
      </Button>
    </FullscreenModal>
  );
}
