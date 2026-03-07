"use client";
import { Box, Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import {
  createCollection,
  eq,
  localStorageCollectionOptions,
  not,
  useLiveQuery,
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import { atom } from "jotai";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import z from "zod";
import {
  BasePlayerEvent,
  basePlayerEventSchema,
  type InterceptionEvent,
  type PlayerEvent,
  playerEventSchema,
  playerSchema,
} from "@/datamodel";

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

// const currentEvent = atom({});

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

  // const userIdCounter = useRef(1);
  const [isPickPlayerDialogOpen, setIsPickPlayerDialogOpen] = useState(false);

  const currentEvent = useRef<Partial<PlayerEvent>>({});

  const finishCurrentEvent = () => {
    try {
      const parsedEvent = playerEventSchema.parse(currentEvent.current);
      try {
        playerEventsCollection.insert(parsedEvent);
        console.log("Inserted event:", parsedEvent);
      } catch (error) {
        console.error("Failed to insert event into collection:", error);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        // TODO
        error.issues;
        console.error("Validation error:", error.issues);
      }
    }
  };
  // const currentInterceptionEvent = useRef<Partial<InterceptionEvent>>({});
  // currentEvent.current.event = "interception";

  return (
    <>
      <Box sx={{ height: "100%", width: "100%" }}>
        sa
        <h1>In Game</h1>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexDirection: "column",
            margin: "auto",
            width: "fit-content",
          }}
        >
          {/* <Button onClick={() => playersCollection.insert({ number: 1 })}>
            Add Sample Player
          </Button> */}
          {/* <Button
            variant="contained"
            onClick={() =>
              playerEventsCollection.insert({
                id: nextUserId.data ? nextUserId.data.id + 1 : 1,
                game_id: 1,
                ellapsed_seconds: 0,
                player: 1,
                event: {
                  goal: true,
                  direction: "OnTarget",
                },
                eventType: "shot",
              })
            }
          >
            Insert Sample Shot
          </Button> */}
          <Button
            variant="contained"
            onClick={() => {
              // userPreferencesCollection.insert({
              //   id: nextUserId.data ? nextUserId.data.id + 1 : 1,
              //   game_id: 1,
              //   ellapsed_seconds: 0,
              //   event: "interception",
              // });
              currentEvent.current = {
                id: nextUserId.data ? nextUserId.data.id + 1 : 1,
                game_id: 1,
                ellapsed_seconds: 0,
                eventType: "interception",
              };
              setIsPickPlayerDialogOpen(true);
            }}
          >
            Interception
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
        open={isPickPlayerDialogOpen}
        // TODO: players={players}
        players={[
          { number: 1 },
          { number: 2 },
          { number: 3 },
          { number: 4 },
          { number: 5 },
        ]}
        onPickPlayer={(pickedPlayer) => {
          setIsPickPlayerDialogOpen(false);
          if (pickedPlayer) {
            currentEvent.current.player = pickedPlayer;
            console.log("Picked player:", pickedPlayer);
            finishCurrentEvent();
          } else {
            currentEvent.current = {};
          }
        }}
      />
    </>
  );
}

// // TODO: only keep this for testing, while InGame is using localStorageCollection, which is not SSR compatible.
// // Once we have a proper collection setup, we can remove this and use InGame directly in the page.
export default dynamic(() => Promise.resolve(InGame), {
  ssr: false,
});

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
    <Dialog fullScreen open={open}>
      {/* <DialogTitle>Pick a Player</DialogTitle> */}
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {players.map((player) => (
            <Button
              key={player.number}
              variant="contained"
              onClick={() => {
                onPickPlayer(player.number);
              }}
            >
              Player {player.number}
            </Button>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
