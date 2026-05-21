"use client";
import BoltIcon from "@mui/icons-material/Bolt";
import CloseIcon from "@mui/icons-material/Close";
import ShieldIcon from "@mui/icons-material/Shield";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import WarningIcon from "@mui/icons-material/Warning";
import {
  AppBar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
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
  quickSubPairsCollection,
  teamPlayersCollection,
} from "@/collections";
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
  initialInGameControlsState,
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

function InGame() {
  const setInGameControls = useSetAtom(inGameControlsAtom);

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
    activeGamePauseToggles,
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
    setInGameControls({
      matchStatus,
      isRunning,
      disableStartFirstHalf: firstHalfStartingPlayerNumbers.length === 0,
      disableStartSecondHalf: secondHalfStartingPlayerNumbers.length === 0,
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
    firstHalfStartingPlayerNumbers.length,
    secondHalfStartingPlayerNumbers.length,
    setInGameControls,
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
          ) : startingPlayerNumbers.length === 0 ? (
            <Box
              sx={{
                bgcolor: "rgba(237, 108, 2, 0.08)",
                border: "1px solid",
                borderColor: "rgba(237, 108, 2, 0.3)",
                borderRadius: 2,
                p: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.5,
                maxWidth: 400,
                mx: "auto",
              }}
            >
              <Typography
                variant="body2"
                color="warning.dark"
                fontWeight="medium"
                textAlign="center"
              >
                Starting lineup is not defined yet. Set the starting players to
                enable accurate tracking of who is on court.
              </Typography>
              <Button
                variant="contained"
                color="warning"
                onClick={() => setStarting7DialogOpen(true)}
                size="small"
              >
                Set Starting Lineup
              </Button>
            </Box>
          ) : (
            <Box sx={{ width: "100%", maxWidth: 400, mx: "auto", my: 1 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  fontWeight="bold"
                >
                  On Court ({activePlayerNumbers.size})
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{ gap: 1 }}
              >
                {Array.from(activePlayerNumbers).map((num) => {
                  const p = selectedTeamPlayers.find(
                    (player) => player.number === num,
                  );
                  return (
                    <Chip
                      key={num}
                      label={`#${num} ${p ? p.name.split(" ")[0] : ""}`}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  );
                })}
              </Stack>
            </Box>
          )}
          <EventGroupButtons
            onRecordEvent={handleStartEvent}
            disabled={
              !activeGame.data ||
              selectedTeamPlayers.length === 0 ||
              startingPlayerNumbers.length === 0
            }
          />
        </Box>
        <EventLog events={activeGameEvents} getPlayerLabel={getPlayerLabel} />
      </Box>
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
    <Box sx={{ width: "100%", mt: 1 }}>
      <Grid container spacing={2}>
        <Grid size={6}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<BoltIcon />}
            onClick={() => onRecordEvent("attack")}
            disabled={disabled}
            sx={{
              bgcolor: "warning.main",
              color: "warning.contrastText",
              "&:hover": { bgcolor: "warning.dark" },
              textTransform: "none",
              py: 1.5,
              fontSize: "1rem",
              borderRadius: 2,
              boxShadow: 3,
            }}
          >
            Attack
          </Button>
        </Grid>
        <Grid size={6}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<ShieldIcon />}
            onClick={() => onRecordEvent("defense")}
            disabled={disabled}
            sx={{
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "&:hover": { bgcolor: "primary.dark" },
              textTransform: "none",
              py: 1.5,
              fontSize: "1rem",
              borderRadius: 2,
              boxShadow: 3,
            }}
          >
            Defense
          </Button>
        </Grid>
        <Grid size={6}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<WarningIcon />}
            onClick={() => onRecordEvent("sanction")}
            disabled={disabled}
            sx={{
              bgcolor: "error.main",
              color: "error.contrastText",
              "&:hover": { bgcolor: "error.dark" },
              textTransform: "none",
              py: 1.5,
              fontSize: "1rem",
              borderRadius: 2,
              boxShadow: 3,
            }}
          >
            Sanction
          </Button>
        </Grid>
        <Grid size={6}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<SwapHorizIcon />}
            onClick={() => onRecordEvent("substitution")}
            disabled={disabled}
            sx={{
              bgcolor: "success.main",
              color: "success.contrastText",
              "&:hover": { bgcolor: "success.dark" },
              textTransform: "none",
              py: 1.5,
              fontSize: "1rem",
              borderRadius: 2,
              boxShadow: 3,
            }}
          >
            Substitution
          </Button>
        </Grid>
      </Grid>
    </Box>
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
    <ListSelectionDialog
      open={open}
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogContent>
        <Stack spacing={2} sx={{ py: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            Define Starting Lineup
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select {targetCount} starting players.
            {selected.length !== targetCount &&
              ` (Currently selected: ${selected.length})`}
          </Typography>

          <Box
            sx={{
              maxHeight: 300,
              overflowY: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <List>
              {players.map((player) => {
                const isChecked = selected.includes(player.number);
                return (
                  <ListItemButton
                    key={player.number}
                    onClick={() => handleToggle(player.number)}
                  >
                    <Checkbox checked={isChecked} edge="start" disableRipple />
                    <ListItemText
                      primary={`#${player.number} ${player.name}`}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button onClick={onClose} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => onSave(selected)}
              disabled={!isValid}
            >
              Save Lineup
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
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
    <Dialog fullScreen open={open}>
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Substitution
          </Typography>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {pairs.length > 0 && (
            <>
              <Typography
                variant="subtitle2"
                fontWeight="bold"
                color="text.secondary"
              >
                Quick Substitutions
              </Typography>
              <Stack spacing={1.5}>
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
                      variant={isDisabled ? "outlined" : "contained"}
                      color="success"
                      disabled={isDisabled}
                      onClick={() => {
                        if (playerOut !== null && playerIn !== null) {
                          onQuickSub(playerOut, playerIn);
                        }
                      }}
                      sx={{
                        py: 2.5,
                        px: 2,
                        borderRadius: 3,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        textTransform: "none",
                      }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        justifyContent="center"
                      >
                        <Typography
                          variant="body1"
                          fontWeight="bold"
                          sx={{ color: isDisabled ? "inherit" : "error.light" }}
                        >
                          {getPlayerLabel(pair.playerNumberA)}
                        </Typography>
                        <SwapHorizIcon />
                        <Typography
                          variant="body1"
                          fontWeight="bold"
                          sx={{
                            color: isDisabled ? "inherit" : "success.light",
                          }}
                        >
                          {getPlayerLabel(pair.playerNumberB)}
                        </Typography>
                      </Stack>
                      {disabledReason && (
                        <Typography variant="caption" color="text.secondary">
                          {disabledReason}
                        </Typography>
                      )}
                      {!disabledReason &&
                        playerOut !== null &&
                        playerIn !== null && (
                          <Typography variant="caption" sx={{ opacity: 0.85 }}>
                            {getPlayerLabel(playerOut)} out /{" "}
                            {getPlayerLabel(playerIn)} in
                          </Typography>
                        )}
                    </Button>
                  );
                })}
              </Stack>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  or
                </Typography>
              </Divider>
            </>
          )}
          <Button
            variant="outlined"
            size="large"
            onClick={onPickManually}
            sx={{ py: 2, borderRadius: 3, textTransform: "none" }}
          >
            Pick players manually →
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
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

// Abstracted list style dialog, since the 3 dialogs are very similar, only differing in the options they show and the type of data they return.
interface Option<T> {
  text: string;
  key: string;
  value: T;
  group?: string;
  disabled?: boolean;
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
          {options.every((o) => !o.group)
            ? options.map((option) => (
                <Button
                  key={option.key}
                  variant="contained"
                  disabled={option.disabled}
                  onClick={() => {
                    onPickOption(option.value);
                  }}
                >
                  {option.text}
                </Button>
              ))
            : Array.from(new Set(options.map((o) => o.group || ""))).map(
                (groupName) => (
                  <Box
                    key={groupName}
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {groupName && (
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        fontWeight="bold"
                        sx={{ mt: 1 }}
                      >
                        {groupName}
                      </Typography>
                    )}
                    <Stack spacing={1.5}>
                      {options
                        .filter((o) => (o.group || "") === groupName)
                        .map((option) => (
                          <Button
                            key={option.key}
                            variant="contained"
                            disabled={option.disabled}
                            onClick={() => {
                              onPickOption(option.value);
                            }}
                          >
                            {option.text}
                          </Button>
                        ))}
                    </Stack>
                  </Box>
                ),
              )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
