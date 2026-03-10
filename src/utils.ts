import { finished } from "stream";
import { assign, setup } from "xstate";
import { set } from "zod";
import type {
  EventType,
  Player,
  PlayerEvent,
  ShotDirection,
  ShotPosition,
} from "./datamodel";

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

interface Context {
  eventGroup?: EventGroup;
  playerEvent: DeepPartial<PlayerEvent>;
}

// TODO: shouldn't be here I don't think
export type EventGroup = "attack" | "defense" | "sanction";

export type Event =
  | {
      type: "START";
      // eventType: EventType;
      eventGroup: EventGroup;
      ellapsed_seconds: number;
      game_id: number;
      id: number;
    }
  //
  | { type: "PICK_ATTACK_EVENT_TYPE"; eventType: EventType }
  | { type: "PICK_DEFENSE_EVENT_TYPE"; eventType: EventType }
  //
  | { type: "PICK_PLAYER"; player: Player }
  | { type: "PICK_SHOT_DIRECTION"; direction: ShotDirection }
  | { type: "PICK_GOAL_OR_NO_GOAL"; goal: boolean }
  | { type: "PICK_SHOT_POSITION"; position: ShotPosition };
// | { type: "SET_PLAYER"; player: string }
// | { type: "SET_SHOT_DIRECTION"; direction: string }
// | { type: "SET_GOAL"; goal: boolean }
// | { type: "SUBMIT" }
// | { type: "CANCEL" };

export const eventMachine = setup({
  types: {
    context: { playerEvent: {} } as Context,
    events: {} as Event,
  },
  actions: {
    resetContext: assign(() => {
      return {
        playerEvent: {},
      };
    }),
    // allow for the outside to override finishEvent
    finishEvent: () => {},
  },
  guards: {
    isShotEvent: ({ context }) => context.playerEvent.eventType === "shot",
  },
}).createMachine({
  id: "eventFlow",
  initial: "idle",
  context: {
    playerEvent: {},
  },
  states: {
    idle: {
      entry: "resetContext",
      on: {
        START: {
          target: "startingRouting",

          actions: assign(({ context, event }) => {
            return {
              eventGroup: event.eventGroup,
              playerEvent: {
                ...context.playerEvent,
                // eventType: event.eventType,
                ellapsed_seconds: event.ellapsed_seconds,
                game_id: event.game_id,
                id: event.id,
              },
            };
          }),
        },
      },
    },
    startingRouting: {
      always: [
        {
          target: "startingAttack",
          guard: ({ context }) => context.eventGroup === "attack",
        },
        {
          target: "startingDefense",
          guard: ({ context }) => context.eventGroup === "defense",
        },
        {
          target: "startingSanction",
          guard: ({ context }) => context.eventGroup === "sanction",
        },
      ],
    },
    startingSanction: {},
    startingAttack: {
      on: {
        PICK_ATTACK_EVENT_TYPE: [
          {
            target: "startingShot",
            guard: ({ event }) => event.eventType === "shot",
            actions: assign(({ context, event }) => {
              return {
                playerEvent: {
                  ...context.playerEvent,
                  eventType: event.eventType,
                },
              };
            }),
          },
        ],
      },
    },
    startingDefense: {
      on: {
        PICK_DEFENSE_EVENT_TYPE: [
          {
            target: "startingInterception",
            guard: ({ event }) => event.eventType === "interception",
            actions: assign(({ context, event }) => {
              return {
                playerEvent: {
                  ...context.playerEvent,
                  eventType: event.eventType,
                },
              };
            }),
          },
        ],
      },
    },

    // starting: {
    //   always: [
    //     {
    //       target: "startingShot",
    //       guard: ({ context }) => context.playerEvent.eventType === "shot",
    //     },
    //     {
    //       target: "startingInterception",
    //       guard: ({ context }) =>
    //         context.playerEvent.eventType === "interception",
    //     },
    //   ],
    // },
    startingShot: {
      always: {
        target: "pickingPlayer",
      },
    },
    startingInterception: {
      always: {
        target: "pickingPlayer",
      },
    },
    pickingPlayer: {
      on: {
        PICK_PLAYER: [
          {
            target: "finished",
            guard: ({ context }) =>
              context.playerEvent.eventType === "interception",
            actions: assign(({ context, event }) => {
              return {
                playerEvent: { ...context.playerEvent, player: event.player },
              };
            }),
          },
          {
            target: "pickingShotPosition",
            guard: ({ context }) => context.playerEvent.eventType === "shot",
            actions: assign(({ context, event }) => {
              return {
                playerEvent: { ...context.playerEvent, player: event.player },
              };
            }),
          },
        ],
      },
    },
    pickingShotPosition: {
      on: {
        PICK_SHOT_POSITION: {
          target: "pickingShotDirection",
          actions: assign(({ context, event }) => {
            if (context.playerEvent.eventType !== "shot") {
              console.error(
                "Invalid event type in pickingShotPosition state:",
                context.playerEvent.eventType,
              );
              return context; // Return the original context if the event type is invalid
            }
            return {
              ...context,
              playerEvent: {
                ...context.playerEvent,
                event: {
                  ...context.playerEvent.event,
                  position: event.position,
                },
              },
            };
          }),
        },
      },
    },
    pickingShotDirection: {
      on: {
        PICK_SHOT_DIRECTION: {
          target: "pickingShotDirectionRouting",
          actions: assign(({ context, event }) => {
            if (context.playerEvent.eventType !== "shot") {
              console.error(
                "Invalid event type in pickingShotDirection state:",
                context.playerEvent.eventType,
              );
              return context; // Return the original context if the event type is invalid
            }
            return {
              ...context,
              playerEvent: {
                ...context.playerEvent,
                event: {
                  ...context.playerEvent.event,
                  direction: event.direction,
                },
              },
            };
          }),
        },
      },
    },
    pickingShotDirectionRouting: {
      always: [
        {
          target: "pickingGoalOrNoGoal",
          guard: ({ context }) =>
            context.playerEvent.eventType === "shot" &&
            context.playerEvent.event?.direction === "OnTarget",
        },
        {
          target: "finished",
          actions: assign(({ context }) => {
            if (context.playerEvent.eventType !== "shot") {
              console.error(
                "Invalid event type in pickingShotDirectionRouting state:",
                context.playerEvent.eventType,
              );
              return context; // Return the original context if the event type is invalid
            }
            return {
              ...context,
              playerEvent: {
                ...context.playerEvent,
                event: {
                  ...context.playerEvent.event,
                  goal: false,
                },
              },
            };
          }),
        },
      ],
    },
    pickingGoalOrNoGoal: {
      on: {
        PICK_GOAL_OR_NO_GOAL: {
          target: "finished",
          actions: assign(({ context, event }) => {
            if (context.playerEvent.eventType !== "shot") {
              console.error(
                "Invalid event type in pickingGoalOrNoGoal state:",
                context.playerEvent.eventType,
              );
              return context; // Return the original context if the event type is invalid
            }
            return {
              playerEvent: {
                ...context.playerEvent,
                event: {
                  ...context.playerEvent.event,
                  goal: event.goal,
                },
              },
            };
          }),
        },
      },
    },
    finished: {
      entry: "finishEvent",
      always: {
        target: "idle",
      },
    },
  },
});
