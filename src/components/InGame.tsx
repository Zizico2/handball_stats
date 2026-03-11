"use client";
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
import CloseIcon from "@mui/icons-material/Close";
import { useStopwatch } from "react-timer-hook";
import {
  createCollection,
  eq,
  localStorageCollectionOptions,
  not,
  useLiveQuery,
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import { useMachine } from "@xstate/react";
import dynamic from "next/dynamic";
import { assign } from "xstate";
import {
  EventType,
  playerEventSchema,
  playerSchema,
  type ShotDirection,
  shotDirectionSchema,
  shotPosition,
  ShotPosition,
} from "@/datamodel";
import { eventMachine } from "@/utils";
import z from "zod";
import { useState } from "react";
import { usePersistentStopwatch } from "@/usePersistentStopwatch";

const playerEventsCollection = createCollection(
  localStorageCollectionOptions({
    id: "game-events",
    storageKey: "game-events",
    schema: playerEventSchema,
    getKey: (item) => item.id,
  }),
);

const playersCollection = createCollection(
  localStorageCollectionOptions({
    id: "players",
    storageKey: "players",
    schema: playerSchema,
    getKey: (item) => `${item}`,
  }),
);

function InGame() {
  // const shots = useLiveSuspenseQuery((q) =>
  //   q
  //     .from({ shot: playerEventsCollection })
  //     .orderBy(({ shot }) => shot.id, "desc")
  //     .where(({ shot }) => not(eq(shot.eventType, "interception"))),
  // );

  // const interceptions = useLiveSuspenseQuery((q) =>
  //   q
  //     .from({ shot: playerEventsCollection })
  //     .orderBy(({ shot }) => shot.id, "desc")
  //     .where(({ shot }) => eq(shot.eventType, "interception")),
  // );

  const playerEvents = useLiveSuspenseQuery((q) =>
    q.from({ shot: playerEventsCollection }),
  );

  const nextUserId = useLiveSuspenseQuery((q) =>
    q
      .from({ user: playerEventsCollection })
      .orderBy(({ user }) => user.id, "desc")
      // .limit(1)
      .findOne(),
  );

  const players = useLiveSuspenseQuery((q) =>
    q.from({ player: playersCollection }),
  );

  // const {
  //   totalSeconds,
  //   milliseconds,
  //   seconds,
  //   minutes,
  //   hours,
  //   days,
  //   isRunning,
  //   start,
  //   pause,
  //   reset,
  // } = useStopwatch({ autoStart: false });
  const {
    totalSeconds,
    milliseconds,
    seconds,
    minutes,
    hours,
    days,
    isRunning,
    start,
    pause,
    reset,
  } = usePersistentStopwatch({ autoStart: false });

  type MatchStatus = "firstHalf" | "halftime" | "secondHalf";
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [matchPaused, setMatchPaused] = useState(false);

  const [state, send, machineRef] = useMachine(
    eventMachine.provide({
      actions: {
        finishEvent: assign(({ context }) => {
          const eventToInsert = context.playerEvent;
          console.log("Event to insert:", eventToInsert);
          try {
            const parsedEvent = playerEventSchema.parse(eventToInsert);
            try {
              playerEventsCollection.insert(parsedEvent);
              console.log("Inserted event:", parsedEvent);
            } catch (error) {
              console.error("Failed to insert event into collection:", error);
            }
          } catch (error) {
            if (error instanceof z.ZodError) {
              console.error("Validation error:", error.issues);
            } else {
              console.error("Unexpected error during event parsing:", error);
            }
            return context; // Return the original context if parsing fails
          }
          return {};
        }),
      },
    }),
  );

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
          <Box>
            <Typography variant="h4">Match Clock</Typography>
            <Typography>
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </Typography>
          </Box>
          <Button
            color="error"
            variant="outlined"
            onClick={() => {
              const allItems = playerEvents.data;
              for (const item of allItems) {
                console.log("Deleting item:", item);
                playerEventsCollection.delete(item.id);
              }
              localStorage.removeItem("persistentStopwatch");
              setMatchPaused(false);
              setMatchStatus(null);
              reset(new Date(), false);
            }}
          >
            Clear Game
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              start();
              setMatchStatus("firstHalf");
            }}
            disabled={matchStatus !== null}
          >
            Start First Half
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              start();
              setMatchStatus("secondHalf");
            }}
            disabled={matchStatus !== "halftime"}
          >
            Start Second Half
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              const offset = new Date();
              offset.setSeconds(offset.getSeconds() + 60 * 30);
              reset(offset, false);
              setMatchStatus("halftime");
            }}
            disabled={matchStatus !== "firstHalf"}
          >
            Start Halftime
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              if (matchPaused) {
                start();
                setMatchPaused(false);
              } else {
                pause();
                setMatchPaused(true);
              }
            }}
            disabled={matchStatus === null || matchStatus === "halftime"}
          >
            {matchPaused ? "Resume Match" : "Pause Match"}
          </Button>

          <Button
            variant="contained"
            onClick={() => {
              send({
                type: "START",
                eventGroup: "attack",
                ellapsed_seconds: totalSeconds,
                game_id: 1,
                id: nextUserId.data ? nextUserId.data.id + 1 : 1,
              });
            }}
          >
            Attack
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              send({
                type: "START",
                eventGroup: "defense",
                ellapsed_seconds: totalSeconds,
                game_id: 1,
                id: nextUserId.data ? nextUserId.data.id + 1 : 1,
              });
            }}
          >
            Defense
          </Button>
        </Box>
        <Box>
          <h2>Player Events</h2>
          {playerEvents.data.map((event) => (
            <Box key={event.id} sx={{ border: "1px solid black", padding: 1 }}>
              <div>Event ID: {event.id}</div>
              <div>Player: {event.player}</div>
              <div>Game ID: {event.game_id}</div>
              <div>Ellapsed Seconds: {event.ellapsed_seconds}</div>
              <div>Event Type: {event.eventType}</div>
              {"event" in event && event.eventType === "shot" && (
                <>
                  <div>Goal: {event.event.goal ? "Yes" : "No"}</div>
                  <div>
                    Direction: {event.event.direction ?? "Not specified"}
                  </div>
                </>
              )}
            </Box>
          ))}
        </Box>
      </Box>
      <PickPlayerFullscreenDialog
        open={state.matches("pickingPlayer")}
        // TODO: players={players}
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
    </>
  );
}

// TODO: only keep this for testing, while InGame is using localStorageCollection, which is not SSR compatible.
// Once we have a proper collection setup, we can remove this and use InGame directly in the page.
export default dynamic(() => Promise.resolve(InGame), {
  ssr: false,
});

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
        // { text: "Provoked 7m", key: "provoked7m", value: "provoked7m" },
        // { text: "Provoked 2m", key: "provoked2m", value: "provoked2m" },
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

const PickPlayerFullscreenDialog = ({
  players,
  open,
  onPickPlayer,
}: {
  players: { number: number }[];
  open: boolean;
  onPickPlayer: (pickedPlayer: number | null) => void;
}) => {
  // return (
  //   <Dialog fullScreen open={open}>
  //     {/* <DialogTitle>Pick a Player</DialogTitle> */}
  //     <DialogContent>
  //       <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
  //         {players.map((player) => (
  //           <Button
  //             key={player.number}
  //             variant="contained"
  //             onClick={() => {
  //               onPickPlayer(player.number);
  //             }}
  //           >
  //             Player {player.number}
  //           </Button>
  //         ))}
  //       </Box>
  //     </DialogContent>
  //   </Dialog>
  // );
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
