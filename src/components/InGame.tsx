"use client";
import CloseIcon from "@mui/icons-material/Close";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  createCollection,
  localStorageCollectionOptions,
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import { useMachine } from "@xstate/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { assign } from "xstate";
import z from "zod";
import {
  type EventGroup,
  type EventType,
  type PlayerEvent,
  playerEventSchema,
  type ShotDirection,
  type ShotPosition,
  shotDirectionSchema,
  shotPosition,
} from "@/datamodel";
import { usePersistentStopwatch } from "@/usePersistentStopwatch";
import { eventMachine } from "@/utils";

const playerEventsCollection = createCollection(
  localStorageCollectionOptions({
    id: "game-events",
    storageKey: "game-events",
    schema: playerEventSchema,
    getKey: (item) => item.id,
  }),
);

type MatchStatus = "firstHalf" | "halftime" | "secondHalf";

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

function InGame() {
  const playerEvents = useLiveSuspenseQuery((q) =>
    q.from({ event: playerEventsCollection }),
  );

  const lastEvent = useLiveSuspenseQuery((q) =>
    q
      .from({ event: playerEventsCollection })
      .orderBy(({ event }) => event.id, "desc")
      .findOne(),
  );

  const { totalSeconds, minutes, seconds, isRunning, start, pause, reset } =
    usePersistentStopwatch({ autoStart: false });

  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);

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

  const handleClearGame = () => {
    for (const event of playerEvents.data) {
      playerEventsCollection.delete(event.id);
    }
    localStorage.removeItem("persistentStopwatch");
    setMatchStatus(null);
    reset(new Date(), false);
  };

  const handleStartEvent = (eventGroup: EventGroup) => {
    send({
      type: "START",
      eventGroup,
      ellapsed_seconds: totalSeconds,
      game_id: 1,
      id: nextEventId,
    });
  };

  return (
    <>
      <Box sx={{ height: "100%", width: "100%" }}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexDirection: "column",
            margin: "auto",
            width: "fit-content",
          }}
        >
          <MatchClock minutes={minutes} seconds={seconds} />
          <MatchControls
            matchStatus={matchStatus}
            isRunning={isRunning}
            onClearGame={handleClearGame}
            onStartFirstHalf={() => {
              start();
              setMatchStatus("firstHalf");
            }}
            onStartSecondHalf={() => {
              start();
              setMatchStatus("secondHalf");
            }}
            onStartHalftime={() => {
              const offset = new Date();
              offset.setSeconds(offset.getSeconds() + 60 * 30);
              reset(offset, false);
              setMatchStatus("halftime");
            }}
            onTogglePause={() => {
              if (isRunning) {
                pause();
              } else {
                start();
              }
            }}
          />
          <EventGroupButtons onRecordEvent={handleStartEvent} />
        </Box>
        <EventLog events={playerEvents.data} />
      </Box>
      <PickPlayerFullscreenDialog
        open={state.matches("pickingPlayer")}
        // TODO: replace with players from a playersCollection (localStorageCollectionOptions)
        players={[
          { number: 1 },
          { number: 2 },
          { number: 3 },
          { number: 4 },
          { number: 5 },
        ]}
        onPickPlayer={(pickedPlayer) => {
          if (pickedPlayer) {
            console.log("Picked player:", pickedPlayer);
            send({ type: "PICK_PLAYER", player: pickedPlayer });
          } else {
            send({ type: "CANCEL" });
          }
        }}
      />
      <PickShotDirectionDialog
        open={state.matches("pickingShotDirection")}
        onPickDirection={(direction) => {
          if (direction) {
            console.log("Picked direction:", direction);
            send({ type: "PICK_SHOT_DIRECTION", direction });
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

// TODO: only keep this for testing, while InGame is using localStorageCollection, which is not SSR compatible.
// Once we have a proper collection setup, we can remove this and use InGame directly in the page.
export default dynamic(() => Promise.resolve(InGame), {
  ssr: false,
});

function MatchClock({
  minutes,
  seconds,
}: {
  minutes: number;
  seconds: number;
}) {
  return (
    <Box>
      <Typography variant="h4">Match Clock</Typography>
      <Typography>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </Typography>
    </Box>
  );
}

interface MatchControlsProps {
  matchStatus: MatchStatus | null;
  isRunning: boolean;
  onClearGame: () => void;
  onStartFirstHalf: () => void;
  onStartSecondHalf: () => void;
  onStartHalftime: () => void;
  onTogglePause: () => void;
}

function MatchControls({
  matchStatus,
  isRunning,
  onClearGame,
  onStartFirstHalf,
  onStartSecondHalf,
  onStartHalftime,
  onTogglePause,
}: MatchControlsProps) {
  return (
    <>
      <Button color="error" variant="outlined" onClick={onClearGame}>
        Clear Game
      </Button>
      <Button
        variant="outlined"
        onClick={onStartFirstHalf}
        disabled={matchStatus !== null}
      >
        Start First Half
      </Button>
      <Button
        variant="outlined"
        onClick={onStartSecondHalf}
        disabled={matchStatus !== "halftime"}
      >
        Start Second Half
      </Button>
      <Button
        variant="outlined"
        onClick={onStartHalftime}
        disabled={matchStatus !== "firstHalf"}
      >
        Start Halftime
      </Button>
      <Button
        variant="outlined"
        onClick={onTogglePause}
        disabled={matchStatus === null || matchStatus === "halftime"}
      >
        {isRunning ? "Pause Match" : "Resume Match"}
      </Button>
    </>
  );
}

function EventGroupButtons({
  onRecordEvent,
}: {
  onRecordEvent: (group: EventGroup) => void;
}) {
  return (
    <>
      <Button variant="contained" onClick={() => onRecordEvent("attack")}>
        Attack
      </Button>
      <Button variant="contained" onClick={() => onRecordEvent("defense")}>
        Defense
      </Button>
      <Button variant="contained" onClick={() => onRecordEvent("sanction")}>
        Sanction
      </Button>
    </>
  );
}

function EventLog({ events }: { events: PlayerEvent[] }) {
  return (
    <Box>
      <Typography variant="h5">Player Events</Typography>
      {events.map((event) => (
        <Box key={event.id} sx={{ border: "1px solid black", padding: 1 }}>
          <div>Event ID: {event.id}</div>
          <div>Player: {event.player}</div>
          <div>Game ID: {event.game_id}</div>
          <div>Elapsed Seconds: {event.ellapsed_seconds}</div>
          <div>Event Type: {event.eventType}</div>
          {"event" in event && event.eventType === "shot" && (
            <>
              <div>Goal: {event.event.goal ? "Yes" : "No"}</div>
              <div>Direction: {event.event.direction ?? "Not specified"}</div>
            </>
          )}
        </Box>
      ))}
    </Box>
  );
}

const PickAttackEventTypeDialog = ({
  open,
  onPickAttackEventType,
}: {
  open: boolean;
  onPickAttackEventType: (eventType: EventType | null) => void;
}) => {
  return (
    <ListSelectionDialog
      open={open}
      title="Pick Attack Event Type"
      options={[
        { text: "Shot", key: "shot", value: "shot" },
        { text: "Provoked 7m", key: "provoked7m", value: "provoked7m" },
        { text: "Provoked 2m", key: "provoked2m", value: "provoked2m" },
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
    <ListSelectionDialog
      open={open}
      title="Pick Defense Event Type"
      options={[
        { text: "Interception", key: "interception", value: "interception" },
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
    <ListSelectionDialog
      open={open}
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
  open,
  onPickPlayer,
}: {
  players: { number: number }[];
  open: boolean;
  onPickPlayer: (pickedPlayer: number | null) => void;
}) => {
  return (
    <ListSelectionDialog
      open={open}
      title="Pick a Player"
      options={players.map((player) => ({
        text: `Player ${player.number}`,
        key: `${player.number}`,
        value: player.number,
      }))}
      onPickOption={onPickPlayer}
    />
  );
};

const PickShotDirectionDialog = ({
  open,
  onPickDirection,
}: {
  open: boolean;
  onPickDirection: (direction: ShotDirection | null) => void;
}) => {
  return (
    <ListSelectionDialog
      open={open}
      title="Pick Shot Direction"
      options={shotDirectionSchema.options.map((option) => ({
        text: option,
        key: option,
        value: option,
      }))}
      onPickOption={onPickDirection}
    />
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
    <ListSelectionDialog
      open={open}
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
    <ListSelectionDialog
      open={open}
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

// Abstracted list style dialog, since the 3 dialogs are very similar, only differing in the options they show and the type of data they return.
interface Option<T> {
  text: string;
  key: string;
  value: T;
}

function ListSelectionDialog<T>({
  open,
  title,
  options,
  onPickOption,
}: {
  open: boolean;
  title: string;
  options: Option<T>[];
  onPickOption: (option: T | null) => void;
}) {
  return (
    <Dialog fullScreen open={open}>
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => onPickOption(null)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            {title}
          </Typography>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {options.map((option) => (
            <Button
              key={option.key}
              variant="contained"
              onClick={() => {
                onPickOption(option.value);
              }}
            >
              {option.text}
            </Button>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
