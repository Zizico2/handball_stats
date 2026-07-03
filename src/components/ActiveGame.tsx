"use client";
import {
  Button,
  Checkbox,
  Chip,
  Modal,
  Separator,
  Surface,
  Typography,
} from "@heroui/react";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMachine } from "@xstate/react";
import { useSetAtom } from "jotai";
import { ArrowLeftRight, Bolt, Shield, TriangleAlert } from "lucide-react";
import NextLink from "next/link";
import { useCallback, useEffect, useState } from "react";
import { assign } from "xstate";
import z from "zod";
import {
  activeGameCollection,
  gamesCollection,
  playerEventsCollection,
  quickSubPairsCollection,
  teamPlayersCollection,
} from "@/collections";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
import { ListSelectionModal } from "@/components/ui/ListSelectionModal";
import {
  type EventGroup,
  type EventType,
  type PlayerEvent,
  playerEventSchema,
  type QuickSubPair,
  type ShotAim,
  type ShotDirectionFields,
  type ShotPosition,
  shotAimSchema,
  shotPosition,
  type TeamPlayer,
} from "@/datamodel";
import { eventMachine } from "@/event_form_fsm";
import {
  inGameControlsAtom,
  initialActiveGameControlsState,
  type MatchStatus,
} from "@/inGameControlsAtoms";
import { useServerMatchClock } from "@/useServerMatchClock";
import { EventLog } from "./EventLog";

function insertPlayerEvent(partialEvent: unknown): void {
  try {
    const parsedEvent = playerEventSchema.parse(partialEvent);
    playerEventsCollection.insert(parsedEvent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
    } else {
      console.error("Failed to insert player event:", error);
    }
  }
}

function ActiveGame() {
  const setActiveGameControls = useSetAtom(inGameControlsAtom);

  const playerEvents = useLiveSuspenseQuery((q) =>
    q.from({ event: playerEventsCollection }),
  );

  const games = useLiveSuspenseQuery((q) => q.from({ game: gamesCollection }));

  // TODO: should the `activeGameCollection` "join" with the `gamesCollection` to get the info directly?
  // TODO: having this logic in a UI components feels off. Maybe there's a notion of "derived collections",
  // TODO: or some sort of service layer where this kind of logic can live?
  const activeGame = useLiveSuspenseQuery((q) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
  );

  const teamPlayers = useLiveSuspenseQuery((q) =>
    q.from({ player: teamPlayersCollection }),
  );

  const lastEvent = useLiveSuspenseQuery((q) =>
    q
      .from({ event: playerEventsCollection })
      .orderBy(({ event }) => event.id, "desc")
      .findOne(),
  );

  const quickSubPairs = useLiveSuspenseQuery((q) =>
    q.from({ pair: quickSubPairsCollection }),
  );

  const activeGameData = activeGame.data ?? null;

  const activeGameRecord = activeGameData
    ? (games.data.find((game) => game.id === activeGameData.gameId) ?? null)
    : null;

  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [starting7DialogOpen, setStarting7DialogOpen] = useState(false);
  const [quickSubDialogOpen, setQuickSubDialogOpen] = useState(false);

  const [state, send] = useMachine(
    eventMachine.provide({
      actions: {
        finishEvent: assign(({ context }) => {
          insertPlayerEvent(context.playerEvent);
          return {};
        }),
      },
    }),
  );

  const nextEventId = (lastEvent.data?.id ?? 0) + 1;

  const selectedTeamPlayers = teamPlayers.data
    .filter((player) => player.teamId === activeGame.data?.homeTeamId)
    .sort((left, right) => left.number - right.number);

  const {
    activeHalf,
    clearClockState,
    eventElapsedSeconds,
    isRunning,
    minutes,
    seconds,
    startFirstHalf,
    startHalftime,
    startSecondHalf,
    togglePause,
  } = useServerMatchClock({
    activeGameData,
    activeGameRecord,
    matchStatus,
    setMatchStatus,
  });

  const handleEndMatch = useCallback(() => {
    if (!activeGameData) {
      return;
    }

    activeGameCollection.delete(activeGameData.id);
    clearClockState();
  }, [activeGameData, clearClockState]);

  const handleStartEvent = (eventGroup: EventGroup) => {
    if (!activeGame.data) {
      return;
    }

    if (!activeHalf) {
      return;
    }

    // Substitution opens the quick-sub pre-step dialog instead of the FSM directly
    if (eventGroup === "substitution") {
      setQuickSubDialogOpen(true);
      return;
    }

    send({
      type: "START",
      eventGroup,
      ellapsed_seconds: eventElapsedSeconds,
      game_id: activeGame.data.gameId,
      id: nextEventId,
      half: activeHalf,
    });
  };

  const activeGameEvents = activeGameData
    ? playerEvents.data.filter(
        (event) => event.game_id === activeGameData.gameId,
      )
    : [];

  const currentHalfForStarting =
    matchStatus === "secondHalf" || matchStatus === "halftime"
      ? "secondHalf"
      : "firstHalf";

  const startingEvents = activeGameEvents.filter(
    (e) =>
      e.eventType === "startingPlayer" && e.half === currentHalfForStarting,
  );
  const startingPlayerNumbers = startingEvents.map((e) => e.player);
  const firstHalfStartingPlayerNumbers = activeGameEvents
    .filter((e) => e.eventType === "startingPlayer" && e.half === "firstHalf")
    .map((e) => e.player);
  const secondHalfStartingPlayerNumbers = activeGameEvents
    .filter((e) => e.eventType === "startingPlayer" && e.half === "secondHalf")
    .map((e) => e.player);

  const activePlayerNumbers = getActivePlayers(activeGameEvents);

  const handleSaveStarting7 = (numbers: number[]) => {
    if (!activeGameData) return;

    // 1. Delete all existing startingPlayer events for this game and current half
    const existingStarting = activeGameEvents.filter(
      (e) =>
        e.eventType === "startingPlayer" && e.half === currentHalfForStarting,
    );
    for (const event of existingStarting) {
      playerEventsCollection.delete(event.id);
    }

    // 2. Insert new startingPlayer events
    numbers.forEach((num, index) => {
      const eventId = nextEventId + index;
      insertPlayerEvent({
        id: eventId,
        player: num,
        game_id: activeGameData.gameId,
        ellapsed_seconds: 0,
        half: currentHalfForStarting,
        eventType: "startingPlayer",
        eventGroup: "substitution",
      });
    });

    setStarting7DialogOpen(false);
  };

  useEffect(() => {
    setActiveGameControls({
      hasActiveGame: activeGameData !== null,
      matchStatus,
      isRunning,
      disableStartFirstHalf: firstHalfStartingPlayerNumbers.length === 0,
      disableStartSecondHalf: secondHalfStartingPlayerNumbers.length === 0,
      onEndMatch: handleEndMatch,
      onStartFirstHalf: startFirstHalf,
      onStartSecondHalf: startSecondHalf,
      onStartHalftime: startHalftime,
      onTogglePause: togglePause,
    });

    return () => {
      setActiveGameControls(initialActiveGameControlsState);
    };
  }, [
    activeGameData,
    handleEndMatch,
    isRunning,
    matchStatus,
    firstHalfStartingPlayerNumbers.length,
    secondHalfStartingPlayerNumbers.length,
    setActiveGameControls,
    startFirstHalf,
    startHalftime,
    startSecondHalf,
    togglePause,
  ]);

  const getPlayerLabel = useCallback(
    (number: number) => {
      const player = teamPlayers.data.find(
        (p) => p.number === number && p.teamId === activeGameData?.homeTeamId,
      );
      return player ? `#${player.number} ${player.name}` : `#${number}`;
    },
    [teamPlayers.data, activeGameData?.homeTeamId],
  );

  return (
    <>
      <div className="h-full w-full">
        <div className="mx-auto flex w-fit flex-col gap-4">
          <MatchClock minutes={minutes} seconds={seconds} />
          {!activeGame.data ? (
            <div className="flex flex-col gap-2">
              <Typography.Paragraph color="muted">
                No active game. Choose a home team first.
              </Typography.Paragraph>
              <NextLink className="link" href="/new-game">
                Go to New Game
              </NextLink>
            </div>
          ) : startingPlayerNumbers.length === 0 ? (
            <Surface
              className="mx-auto flex max-w-[400px] flex-col items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4"
              variant="secondary"
            >
              <Typography.Paragraph className="text-center font-medium text-warning">
                Starting lineup is not defined yet. Set the starting players to
                enable accurate tracking of who is on court.
              </Typography.Paragraph>
              <Button
                size="sm"
                variant="primary"
                onPress={() => setStarting7DialogOpen(true)}
              >
                Set Starting Lineup
              </Button>
            </Surface>
          ) : (
            <div className="mx-auto my-2 w-full max-w-[400px]">
              <Typography.Paragraph color="muted" className="mb-2 font-bold">
                On Court ({activePlayerNumbers.size})
              </Typography.Paragraph>
              <div className="flex flex-wrap gap-2">
                {Array.from(activePlayerNumbers).map((num) => {
                  const p = selectedTeamPlayers.find(
                    (player) => player.number === num,
                  );
                  return (
                    <Chip
                      key={num}
                      color="accent"
                      size="sm"
                      variant="secondary"
                    >
                      #{num} {p ? p.name.split(" ")[0] : ""}
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}
          <EventGroupButtons
            onRecordEvent={handleStartEvent}
            disabled={
              !activeGame.data ||
              selectedTeamPlayers.length === 0 ||
              startingPlayerNumbers.length === 0 ||
              !(matchStatus === "firstHalf" || matchStatus === "secondHalf")
            }
          />
        </div>
        <EventLog events={activeGameEvents} getPlayerLabel={getPlayerLabel} />
      </div>
      <PickPlayerFullscreenDialog
        open={state.matches("pickingPlayer")}
        players={selectedTeamPlayers}
        activePlayerNumbers={activePlayerNumbers}
        prioritizeActive={true}
        selectionMode={
          state.context.playerEvent.eventType === "substitution"
            ? "onCourtOnly"
            : "all"
        }
        title={
          state.context.playerEvent.eventType === "substitution"
            ? "Pick Player Leaving"
            : "Pick a Player"
        }
        onPickPlayer={(pickedPlayer) => {
          if (pickedPlayer) {
            console.log("Picked player:", pickedPlayer);
            send({ type: "PICK_PLAYER", player: pickedPlayer });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      <PickPlayerFullscreenDialog
        open={state.matches("pickingSubstitutionPlayerIn")}
        players={selectedTeamPlayers}
        activePlayerNumbers={activePlayerNumbers}
        prioritizeActive={false}
        selectionMode="benchOnly"
        title="Pick Player Entering"
        onPickPlayer={(pickedPlayer) => {
          if (pickedPlayer) {
            console.log("Picked entering player:", pickedPlayer);
            send({ type: "PICK_PLAYER", player: pickedPlayer });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      {starting7DialogOpen && (
        <PickStarting7Dialog
          open={starting7DialogOpen}
          players={selectedTeamPlayers}
          currentStartingNumbers={startingPlayerNumbers}
          onSave={handleSaveStarting7}
          onClose={() => setStarting7DialogOpen(false)}
        />
      )}
      {quickSubDialogOpen &&
        activeHalf &&
        activeGame.data &&
        (() => {
          const gameId = activeGame.data.gameId;
          const homeTeamId = activeGame.data.homeTeamId;
          return (
            <QuickSubDialog
              open={quickSubDialogOpen}
              pairs={quickSubPairs.data.filter((p) => p.teamId === homeTeamId)}
              players={selectedTeamPlayers}
              activePlayerNumbers={activePlayerNumbers}
              onQuickSub={(playerOut, playerIn) => {
                insertPlayerEvent({
                  id: nextEventId,
                  player: playerOut,
                  game_id: gameId,
                  ellapsed_seconds: eventElapsedSeconds,
                  half: activeHalf,
                  eventType: "substitution",
                  eventGroup: "substitution",
                  event: { playerIn },
                });
                setQuickSubDialogOpen(false);
              }}
              onPickManually={() => {
                setQuickSubDialogOpen(false);
                send({
                  type: "START",
                  eventGroup: "substitution",
                  ellapsed_seconds: eventElapsedSeconds,
                  game_id: gameId,
                  id: nextEventId,
                  half: activeHalf,
                });
              }}
              onClose={() => setQuickSubDialogOpen(false)}
            />
          );
        })()}
      <PickShotDirectionDialog
        open={state.matches("pickingShotDirection")}
        onPick={(pick) => {
          if (pick) {
            console.log("Picked shot target:", pick);
            send({ type: "PICK_SHOT_DIRECTION", pick });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      <PickGoalOrNoGoalDialog
        open={state.matches("pickingGoalOrNoGoal")}
        onPickGoalOrNoGoal={(goal) => {
          if (goal !== null) {
            console.log("Picked goal or no goal:", goal);
            send({ type: "PICK_GOAL_OR_NO_GOAL", goal });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      <PickShotPositionDialog
        open={state.matches("pickingShotPosition")}
        onPickShotPosition={(position) => {
          if (position) {
            console.log("Picked shot position:", position);
            send({ type: "PICK_SHOT_POSITION", position });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      <PickAttackEventTypeDialog
        open={state.matches("startingAttack")}
        onPickAttackEventType={(eventType) => {
          if (eventType) {
            console.log("Picked attack event type:", eventType);
            send({ type: "PICK_ATTACK_EVENT_TYPE", eventType });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      <PickDefenseEventTypeDialog
        open={state.matches("startingDefense")}
        onPickDefenseEventType={(eventType) => {
          if (eventType) {
            console.log("Picked defense event type:", eventType);
            send({ type: "PICK_DEFENSE_EVENT_TYPE", eventType });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      <PickSanctionEventTypeDialog
        open={state.matches("startingSanction")}
        onPickSanctionEventType={(eventType) => {
          if (eventType) {
            console.log("Picked sanction event type:", eventType);
            send({ type: "PICK_SANCTION_EVENT_TYPE", eventType });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
    </>
  );
}

export default ActiveGame;

function MatchClock({
  minutes,
  seconds,
}: {
  minutes: number;
  seconds: number;
}) {
  return (
    <div>
      <Typography.Heading level={4}>Match Clock</Typography.Heading>
      <Typography.Paragraph>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </Typography.Paragraph>
    </div>
  );
}

function EventGroupButtons({
  onRecordEvent,
  disabled,
}: {
  onRecordEvent: (group: EventGroup) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-2 w-full">
      <div className="grid grid-cols-2 gap-4">
        <Button
          className="h-auto bg-warning py-3 text-warning-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("attack")}
        >
          <Bolt className="size-4" />
          Attack
        </Button>
        <Button
          className="h-auto bg-accent py-3 text-accent-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("defense")}
        >
          <Shield className="size-4" />
          Defense
        </Button>
        <Button
          className="h-auto bg-danger py-3 text-danger-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("sanction")}
        >
          <TriangleAlert className="size-4" />
          Sanction
        </Button>
        <Button
          className="h-auto bg-success py-3 text-success-foreground shadow-md"
          isDisabled={disabled}
          variant="primary"
          onPress={() => onRecordEvent("substitution")}
        >
          <ArrowLeftRight className="size-4" />
          Substitution
        </Button>
      </div>
    </div>
  );
}

// EventLog component is imported from ./EventLog

const PickAttackEventTypeDialog = ({
  open,
  onPickAttackEventType,
}: {
  open: boolean;
  onPickAttackEventType: (eventType: EventType | null) => void;
}) => {
  return (
    <ListSelectionModal
      isOpen={open}
      title="Pick Attack Event Type"
      options={[
        { text: "Shot", key: "shot", value: "shot" },
        {
          text: "Provoked 7meter",
          key: "provoked7meter",
          value: "provoked7meter",
        },
        { text: "Provoked 2min", key: "provoked2min", value: "provoked2min" },
        { text: "Travelling", key: "travelling", value: "travelling" },
        { text: "Dribble Fault", key: "dribbleFault", value: "dribbleFault" },
        { text: "Forcing", key: "forcing", value: "forcing" },
        { text: "Lost Ball", key: "lostBall", value: "lostBall" },
      ]}
      onPickOption={onPickAttackEventType}
    />
  );
};

const PickDefenseEventTypeDialog = ({
  open,
  onPickDefenseEventType,
}: {
  open: boolean;
  onPickDefenseEventType: (eventType: EventType | null) => void;
}) => {
  return (
    <ListSelectionModal
      isOpen={open}
      title="Pick Defense Event Type"
      options={[
        { text: "Interception", key: "interception", value: "interception" },
        {
          text: "7 Meter Conceded",
          key: "sevenMeterConceded",
          value: "sevenMeterConceded",
        },
        { text: "1-on-1 Lost", key: "oneOnOneLost", value: "oneOnOneLost" },
        { text: "Blocked Shot", key: "blockedShot", value: "blockedShot" },
        {
          text: "Offensive Foul",
          key: "offensiveFoul",
          value: "offensiveFoul",
        },
      ]}
      onPickOption={onPickDefenseEventType}
    />
  );
};

const PickSanctionEventTypeDialog = ({
  open,
  onPickSanctionEventType,
}: {
  open: boolean;
  onPickSanctionEventType: (eventType: EventType | null) => void;
}) => {
  return (
    <ListSelectionModal
      isOpen={open}
      title="Pick Sanction Event Type"
      options={[
        { text: "Red Card", key: "redCard", value: "redCard" },
        { text: "Yellow Card", key: "yellowCard", value: "yellowCard" },
        {
          text: "2 Minute Suspension",
          key: "twoMinuteSuspension",
          value: "twoMinuteSuspension",
        },
      ]}
      onPickOption={onPickSanctionEventType}
    />
  );
};

const PickPlayerFullscreenDialog = ({
  players,
  activePlayerNumbers,
  prioritizeActive = true,
  selectionMode = "all",
  open,
  title = "Pick a Player",
  onPickPlayer,
}: {
  players: TeamPlayer[];
  activePlayerNumbers: Set<number>;
  prioritizeActive?: boolean;
  selectionMode?: "all" | "onCourtOnly" | "benchOnly";
  open: boolean;
  title?: string;
  onPickPlayer: (pickedPlayer: number | null) => void;
}) => {
  const hasStartingLineup = activePlayerNumbers.size > 0;

  const sortedPlayers = [...players].sort((a, b) => {
    if (hasStartingLineup) {
      const aActive = activePlayerNumbers.has(a.number);
      const bActive = activePlayerNumbers.has(b.number);
      if (aActive && !bActive) return prioritizeActive ? -1 : 1;
      if (!aActive && bActive) return prioritizeActive ? 1 : -1;
    }
    return a.number - b.number;
  });

  return (
    <ListSelectionModal
      isOpen={open}
      title={title}
      options={sortedPlayers.map((player) => ({
        text: `#${player.number} ${player.name}`,
        key: `${player.number}`,
        value: player.number,
        disabled:
          selectionMode === "onCourtOnly"
            ? !activePlayerNumbers.has(player.number)
            : selectionMode === "benchOnly"
              ? activePlayerNumbers.has(player.number)
              : false,
        group: hasStartingLineup
          ? activePlayerNumbers.has(player.number)
            ? "On Court"
            : "Bench"
          : undefined,
      }))}
      onPickOption={onPickPlayer}
    />
  );
};

const PickStarting7Dialog = ({
  open,
  players,
  currentStartingNumbers,
  onSave,
  onClose,
}: {
  open: boolean;
  players: TeamPlayer[];
  currentStartingNumbers: number[];
  onSave: (numbers: number[]) => void;
  onClose: () => void;
}) => {
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
                          {`#${player.number} ${player.name}`}
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
};

const SHOT_AIM_LABELS: Record<ShotAim, string> = {
  TopLeft: "Top left",
  TopCenter: "Top center",
  TopRight: "Top right",
  MiddleLeft: "Middle left",
  MiddleCenter: "Middle center",
  MiddleRight: "Middle right",
  BottomLeft: "Bottom left",
  BottomCenter: "Bottom center",
  BottomRight: "Bottom right",
};

const PickShotDirectionDialog = ({
  open,
  onPick,
}: {
  open: boolean;
  onPick: (pick: ShotDirectionFields | null) => void;
}) => {
  return (
    <FullscreenModal
      isOpen={open}
      onClose={() => onPick(null)}
      title="Shot target"
    >
      <Typography.Paragraph color="muted" className="text-center">
        Tap the zone on the goal. Handball goals are wider than they are
        tall—this frame matches that shape.
      </Typography.Paragraph>
      <div className="w-full max-w-[380px] self-center">
        <div className="mb-1 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onPress={() => onPick({ direction: "OnTarget" })}
          >
            On target
          </Button>
        </div>
        <div className="aspect-[3/2] w-full rounded-lg border-[3px] border-accent bg-surface-secondary p-1.5">
          <div className="grid h-full grid-cols-3 gap-1">
            {shotAimSchema.options.map((aim) => (
              <Button
                key={aim}
                aria-label={SHOT_AIM_LABELS[aim]}
                className="h-full min-h-[52px] text-[0.7rem] leading-tight shadow-none"
                variant="secondary"
                onPress={() => onPick({ direction: "OnTarget", aim })}
              >
                {SHOT_AIM_LABELS[aim]}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex w-full max-w-[380px] flex-col gap-2 self-center sm:flex-row">
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onPick({ direction: "OffTarget" })}
        >
          Off target
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onPick({ direction: "Blocked" })}
        >
          Blocked
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onPick({ direction: "Post" })}
        >
          Post
        </Button>
      </div>
    </FullscreenModal>
  );
};

const PickGoalOrNoGoalDialog = ({
  open,
  onPickGoalOrNoGoal,
}: {
  open: boolean;
  onPickGoalOrNoGoal: (goal: boolean | null) => void;
}) => {
  return (
    <ListSelectionModal
      isOpen={open}
      title="Was it a Goal?"
      options={[
        { text: "Goal", key: "goal", value: true },
        { text: "No Goal", key: "no_goal", value: false },
      ]}
      onPickOption={onPickGoalOrNoGoal}
    />
  );
};

const PickShotPositionDialog = ({
  open,
  onPickShotPosition,
}: {
  open: boolean;
  onPickShotPosition: (position: ShotPosition | null) => void;
}) => {
  return (
    <ListSelectionModal
      isOpen={open}
      title="Pick Shot Position"
      options={shotPosition.options.map((option) => ({
        text: option,
        key: option,
        value: option,
      }))}
      onPickOption={onPickShotPosition}
    />
  );
};

const QuickSubDialog = ({
  open,
  pairs,
  players,
  activePlayerNumbers,
  onQuickSub,
  onPickManually,
  onClose,
}: {
  open: boolean;
  pairs: QuickSubPair[];
  players: TeamPlayer[];
  activePlayerNumbers: Set<number>;
  onQuickSub: (playerOut: number, playerIn: number) => void;
  onPickManually: () => void;
  onClose: () => void;
}) => {
  const getPlayerLabel = (num: number) => {
    const p = players.find((pl) => pl.number === num);
    return p ? `#${num} ${p.name}` : `#${num}`;
  };

  return (
    <FullscreenModal isOpen={open} onClose={onClose} title="Substitution">
      {pairs.length > 0 && (
        <>
          <Typography.Paragraph color="muted" className="font-bold">
            Quick Substitutions
          </Typography.Paragraph>
          <div className="flex flex-col gap-3">
            {pairs.map((pair) => {
              const aOnCourt = activePlayerNumbers.has(pair.playerNumberA);
              const bOnCourt = activePlayerNumbers.has(pair.playerNumberB);

              let playerOut: number | null = null;
              let playerIn: number | null = null;
              let disabledReason: string | null = null;

              if (aOnCourt && bOnCourt) {
                disabledReason = "Both on court";
              } else if (!aOnCourt && !bOnCourt) {
                disabledReason = "Both on bench";
              } else if (aOnCourt) {
                playerOut = pair.playerNumberA;
                playerIn = pair.playerNumberB;
              } else {
                playerOut = pair.playerNumberB;
                playerIn = pair.playerNumberA;
              }

              const isDisabled = disabledReason !== null;

              return (
                <Button
                  key={pair.id}
                  className="flex h-auto flex-col gap-1 rounded-2xl py-5"
                  isDisabled={isDisabled}
                  variant={isDisabled ? "outline" : "primary"}
                  onPress={() => {
                    if (playerOut !== null && playerIn !== null) {
                      onQuickSub(playerOut, playerIn);
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-3">
                    <Typography.Paragraph
                      className={`font-bold ${isDisabled ? "" : "text-danger"}`}
                    >
                      {getPlayerLabel(pair.playerNumberA)}
                    </Typography.Paragraph>
                    <ArrowLeftRight className="size-4" />
                    <Typography.Paragraph
                      className={`font-bold ${isDisabled ? "" : "text-success"}`}
                    >
                      {getPlayerLabel(pair.playerNumberB)}
                    </Typography.Paragraph>
                  </div>
                  {disabledReason ? (
                    <Typography.Paragraph color="muted" className="text-xs">
                      {disabledReason}
                    </Typography.Paragraph>
                  ) : null}
                  {!disabledReason &&
                  playerOut !== null &&
                  playerIn !== null ? (
                    <Typography.Paragraph
                      color="muted"
                      className="text-xs opacity-85"
                    >
                      {getPlayerLabel(playerOut)} out /{" "}
                      {getPlayerLabel(playerIn)} in
                    </Typography.Paragraph>
                  ) : null}
                </Button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <Typography.Paragraph color="muted" className="text-xs">
              or
            </Typography.Paragraph>
            <Separator className="flex-1" />
          </div>
        </>
      )}
      <Button
        className="rounded-2xl py-4"
        size="lg"
        variant="outline"
        onPress={onPickManually}
      >
        Pick players manually →
      </Button>
    </FullscreenModal>
  );
};

export function getActivePlayers(events: PlayerEvent[]): Set<number> {
  const active = new Set<number>();
  const sorted = [...events].sort((a, b) => a.id - b.id);
  let clearedForSecondHalf = false;
  for (const e of sorted) {
    if (e.eventType === "startingPlayer") {
      if (e.half === "secondHalf" && !clearedForSecondHalf) {
        active.clear();
        clearedForSecondHalf = true;
      }
      active.add(e.player);
    } else if (e.eventType === "substitution") {
      active.delete(e.player);
      active.add(e.event.playerIn);
    }
  }
  return active;
}
