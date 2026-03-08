import { setup, assign } from "xstate";
import { EventType, Player, PlayerEvent, ShotDirection } from "./datamodel";
import { finished } from "stream";
import { set } from "zod";

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

// export type PlayerEventPayload = {
//   eventType?: "shot" | "interception";
//   player?: string;
//   shotDirection?: string;
//   goal?: boolean;
// };

export type Event =
  | { type: "START"; eventType: EventType }
  | { type: "PICK_PLAYER"; player: Player }
  | { type: "PICK_SHOT_DIRECTION"; direction: ShotDirection };
// | { type: "SET_PLAYER"; player: string }
// | { type: "SET_SHOT_DIRECTION"; direction: string }
// | { type: "SET_GOAL"; goal: boolean }
// | { type: "SUBMIT" }
// | { type: "CANCEL" };

export const eventMachine = setup({
  types: {
    context: {} as DeepPartial<PlayerEvent>,
    events: {} as Event,
  },
  actions: {
    resetContext: assign(({ context, event }) => {
      return {}; // Return your default PlayerEventPayload properties here
    }),
  },
  guards: {
    isShotEvent: ({ context }) => context.eventType === "shot",
  },
}).createMachine({
  id: "eventFlow",
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: {
        START: [
          {
            target: "startingShot",
            guard: ({ event }) => event.eventType === "shot",
            // actions: assign(({ event }) => {
            //   return { eventType: event.eventType };
            // }),
          },
          {
            target: "startingInterception",
            guard: ({ event }) => event.eventType === "interception",
            // actions: assign(({ event }) => {
            //   return { eventType: event.eventType };
            // }),
          },
        ],
      },
    },
    startingShot: {
      entry: assign(() => {
        return { eventType: "shot" };
      }),
      always: {
        target: "pickingPlayer",
      },
    },
    startingInterception: {
      entry: assign(() => {
        return { eventType: "interception" };
      }),
      always: {
        target: "pickingPlayer",
      },
    },
    pickingPlayer: {
      on: {
        PICK_PLAYER: [
          {
            target: "finished",
            guard: ({ context }) => context.eventType === "interception",
            actions: assign(({ event }) => {
              return { player: event.player };
            }),
          },
          {
            target: "settingShotDirection",
            guard: ({ context }) => context.eventType === "shot",
            actions: assign(({ event }) => {
              return { player: event.player };
            }),
          },
        ],
      },
    },
    pickingShotDirection: {},
    finished: {},
  },
});

// function assign() {
//   throw new Error("Function not implemented.");
// }
