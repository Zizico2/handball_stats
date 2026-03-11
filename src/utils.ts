import { finished } from "stream";
import { assign, setup } from "xstate";
import { set } from "zod";
import type {
  EventGroup,
  EventType,
  Player,
  PlayerEvent,
  ShotDirection,
  ShotPosition,
} from "./datamodel";

// Collects all keys across all union members (distributive)
type AllKeys<T> = T extends object ? keyof T : never;

// Collects the value type for key K across all union members
type DistributedValue<T, K extends PropertyKey> =
  T extends Record<K, infer V> ? V : never;

// Non-distributive DeepPartial: merges all union members into a single flat partial type
// instead of producing a union of partials (which breaks incremental object building)
export type DeepPartial<T> = [T] extends [object]
  ? {
      [K in AllKeys<T>]?: DistributedValue<T, K> extends object
        ? DeepPartial<DistributedValue<T, K>>
        : DistributedValue<T, K>;
    }
  : T;

interface Context {
  // eventGroup?: EventGroup;
  playerEvent: DeepPartial<PlayerEvent>;
}

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
  | { type: "PICK_SANCTION_EVENT_TYPE"; eventType: EventType }
  //
  | { type: "PICK_PLAYER"; player: Player }
  | { type: "PICK_SHOT_DIRECTION"; direction: ShotDirection }
  | { type: "PICK_GOAL_OR_NO_GOAL"; goal: boolean }
  | { type: "PICK_SHOT_POSITION"; position: ShotPosition }
  | { type: "CANCEL" };
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
  // guards: {
  //   isShotEvent: ({ context }) => context.playerEvent.eventType === "shot",
  // },
}).createMachine({
  id: "eventFlow",
  initial: "idle",
  context: {
    playerEvent: {},
  },
  on: {
    CANCEL: {
      target: ".idle",
    },
  },
  states: {
    idle: {
      entry: "resetContext",
      on: {
        START: {
          target: "startingRouting",
          actions: assign(({ context, event }) => {
            return {
              playerEvent: {
                ...context.playerEvent,
                // eventType: event.eventType,
                eventGroup: event.eventGroup,
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
          guard: ({ context }) => context.playerEvent.eventGroup === "attack",
        },
        {
          target: "startingDefense",
          guard: ({ context }) => context.playerEvent.eventGroup === "defense",
        },
        {
          target: "startingSanction",
          guard: ({ context }) => context.playerEvent.eventGroup === "sanction",
        },
      ],
    },
    startingSanction: {
      on: {
        PICK_SANCTION_EVENT_TYPE: [
          {
            target: "pickingPlayer",
            guard: ({ event }) =>
              event.eventType === "redCard" ||
              event.eventType === "yellowCard" ||
              event.eventType === "twoMinuteSuspension",
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
          {
            target: "pickingPlayer",
            guard: ({ event }) =>
              event.eventType === "provoked7m" ||
              event.eventType === "provoked2m",
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
              context.playerEvent.eventType === "interception" ||
              context.playerEvent.eventType === "provoked7m" ||
              context.playerEvent.eventType === "provoked2m" ||
              context.playerEvent.eventType === "redCard" ||
              context.playerEvent.eventType === "yellowCard" ||
              context.playerEvent.eventType === "twoMinuteSuspension",
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
