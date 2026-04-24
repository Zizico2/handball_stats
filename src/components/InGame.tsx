"use client";
import CloseIcon from "@mui/icons-material/Close";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogContent,
  Grid,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMachine } from "@xstate/react";
import { useSetAtom } from "jotai";
import NextLink from "next/link";
import { useCallback, useEffect, useState } from "react";
import { assign } from "xstate";
import z from "zod";
import {
  activeGameCollection,
  gamesCollection,
  pauseTogglesCollection,
  playerEventsCollection,
  teamPlayersCollection,
} from "@/collections";
import {
  type EventGroup,
  type EventType,
  type PlayerEvent,
  playerEventSchema,
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
  initialInGameControlsState,
  type MatchStatus,
} from "@/inGameControlsAtoms";
import { useServerMatchClock } from "@/useServerMatchClock";

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
  const setInGameControls = useSetAtom(inGameControlsAtom);

  const playerEvents = useLiveSuspenseQuery((q) =>
    q.from({ event: playerEventsCollection }),
  );

  const games = useLiveSuspenseQuery((q) => q.from({ game: gamesCollection }));

  const pauseToggles = useLiveSuspenseQuery((q) =>
    q.from({ pauseToggle: pauseTogglesCollection }),
  );

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

  const activeGameData = activeGame.data;
  const activeGameRecord = activeGameData
    ? (games.data.find((game) => game.id === activeGameData.gameId) ?? null)
    : null;

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

  const selectedTeamPlayers = teamPlayers.data
    .filter((player) => player.teamId === activeGame.data?.homeTeamId)
    .sort((left, right) => left.number - right.number);

  const {
    activeGamePauseToggles,
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
    pauseToggles: pauseToggles.data,
    matchStatus,
    setMatchStatus,
  });

  const handleClearGame = useCallback(() => {
    if (activeGameData) {
      for (const event of playerEvents.data.filter(
        (item) => item.game_id === activeGameData.gameId,
      )) {
        playerEventsCollection.delete(event.id);
      }

      for (const toggle of activeGamePauseToggles) {
        pauseTogglesCollection.delete(toggle.id);
      }

      activeGameCollection.delete(activeGameData.id);
    }

    clearClockState();
  }, [
    activeGameData,
    activeGamePauseToggles,
    clearClockState,
    playerEvents.data,
  ]);

  const handleStartEvent = (eventGroup: EventGroup) => {
    if (!activeGame.data) {
      return;
    }

    send({
      type: "START",
      eventGroup,
      ellapsed_seconds: eventElapsedSeconds,
      game_id: activeGame.data.gameId,
      id: nextEventId,
    });
  };

  const activeGameEvents = activeGameData
    ? playerEvents.data.filter(
        (event) => event.game_id === activeGameData.gameId,
      )
    : [];

  useEffect(() => {
    setInGameControls({
      matchStatus,
      isRunning,
      onClearGame: handleClearGame,
      onStartFirstHalf: startFirstHalf,
      onStartSecondHalf: startSecondHalf,
      onStartHalftime: startHalftime,
      onTogglePause: togglePause,
    });

    return () => {
      setInGameControls(initialInGameControlsState);
    };
  }, [
    handleClearGame,
    isRunning,
    matchStatus,
    setInGameControls,
    startFirstHalf,
    startHalftime,
    startSecondHalf,
    togglePause,
  ]);

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
          {!activeGame.data ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography color="text.secondary">
                No active game. Choose a home team first.
              </Typography>
              <Button component={NextLink} href="/new-game" variant="outlined">
                Go to New Game
              </Button>
            </Box>
          ) : null}
          <EventGroupButtons
            onRecordEvent={handleStartEvent}
            disabled={!activeGame.data || selectedTeamPlayers.length === 0}
          />
        </Box>
        <EventLog events={activeGameEvents} />
      </Box>
      <PickPlayerFullscreenDialog
        open={state.matches("pickingPlayer")}
        players={selectedTeamPlayers}
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

export default InGame;

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

function EventGroupButtons({
  onRecordEvent,
  disabled,
}: {
  onRecordEvent: (group: EventGroup) => void;
  disabled: boolean;
}) {
  return (
    <>
      <Button
        variant="contained"
        onClick={() => onRecordEvent("attack")}
        disabled={disabled}
      >
        Attack
      </Button>
      <Button
        variant="contained"
        onClick={() => onRecordEvent("defense")}
        disabled={disabled}
      >
        Defense
      </Button>
      <Button
        variant="contained"
        onClick={() => onRecordEvent("sanction")}
        disabled={disabled}
      >
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
              <div>Aim: {event.event.aim ?? "Not specified"}</div>
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
    <ListSelectionDialog
      open={open}
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
  players: TeamPlayer[];
  open: boolean;
  onPickPlayer: (pickedPlayer: number | null) => void;
}) => {
  return (
    <ListSelectionDialog
      open={open}
      title="Pick a Player"
      options={players.map((player) => ({
        text: `#${player.number} ${player.name}`,
        key: `${player.number}`,
        value: player.number,
      }))}
      onPickOption={onPickPlayer}
    />
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
    <Dialog fullScreen open={open}>
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => onPick(null)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Shot target
          </Typography>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Tap the zone on the goal. Handball goals are wider than they are
            tall—this frame matches that shape.
          </Typography>
          <Box sx={{ width: "100%", maxWidth: 380 }}>
            <Stack alignItems="flex-end" sx={{ mb: 0.5 }}>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => onPick({ direction: "OnTarget" })}
              >
                On target
              </Button>
            </Stack>
            <Box
              sx={{
                width: "100%",
                aspectRatio: "3 / 2",
                p: 0.75,
                border: 3,
                borderColor: "primary.main",
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              <Grid container columns={3} spacing={0.5} sx={{ height: "100%" }}>
                {shotAimSchema.options.map((aim) => (
                  <Grid key={aim} size={1}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="inherit"
                      onClick={() => onPick({ direction: "OnTarget", aim })}
                      aria-label={SHOT_AIM_LABELS[aim]}
                      sx={{
                        minHeight: 52,
                        height: "100%",
                        p: 0.5,
                        fontSize: "0.7rem",
                        lineHeight: 1.2,
                        textTransform: "none",
                        color: "text.secondary",
                        boxShadow: "none",
                      }}
                    >
                      {SHOT_AIM_LABELS[aim]}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            width="100%"
            maxWidth={380}
          >
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={() => onPick({ direction: "OffTarget" })}
            >
              Off target
            </Button>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={() => onPick({ direction: "Blocked" })}
            >
              Blocked
            </Button>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={() => onPick({ direction: "Post" })}
            >
              Post
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
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
