// https://mermaid.ai/live/edit#pako:eNqNVP2PmjAY_le6_rQlnlHxC3JnwpQ5cwaIkiW3w5AOKhKxNaXe5oz_-1oQgfNjxw-0ffs8z_vR9j1AnwYYajDhiONRhEKGNg9vLZcA8QURwz6PKAHO18yS_aMgxuDhYQAEi_GIhDO6kwPQwNzRZ06GIpRjwKJwxQFdppzMLr9xTH-hGAx1c2hMAWeIJJF0lBQQIR1iDuqpsyWjG4DIHqRxZiBMgtSHS7J1unUR0uOjv6KRjweDM6qyX05D5xz5a5HFa8jobguengBKTYv_c0d4iUmCK-Qgs32APUckK3SZnpyMi1KGVbSU2Eb-WtjsGO0xE3x7Mnz25qKwzsQyPeOHYTqe82IbVYk83JsKI-ObYc6NikBV4lStShorynMB3XF0MZT4LnnFb5hwZ7_FaX4CvbipeTWqq6KUrzC7LJKM5ZoQin-jfZLDq7slvOTbNLuWuXt7qr8Ys3uJXMotIxIlKxxcalTjvub2XTij83vMj_m75Xi2NZ_Is76QKeC3dIp3W8iNJjNjmOmV39U9-vs3dg9bCmVMUWwxk8pRXvyi3YiaWsRJG8DiY5KlKpd0PlV0KkoV59fOaWzpU8-aeaaVTnP6GSY5aW_KbxT4vBSOkxPCkBfkC6zBkEUB1Djb4RrcYLZBcgkPUs2F4gZssAs1MQ0QW7vQJUfB2SLyk9JNThMNIVxBbYniRKx226Do1WcrE-0QsyHdEQ61TioBtQP8A7Vmp1lvKKrSb6lKu9NrKDW4F9Zuu95tdtWe0u911Y7SbB1r8G_qtFHv95S2Kja77Y7aaKm94z-Wdw0U

import { assign, setup } from "xstate";
import type {
  EventGroup,
  EventType,
  Player,
  PlayerEvent,
  ShotDirectionFields,
  ShotPosition,
} from "./datamodel";
import type { DeepPartial } from "./utils";

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
  | { type: "PICK_SHOT_DIRECTION"; pick: ShotDirectionFields }
  | { type: "PICK_GOAL_OR_NO_GOAL"; goal: boolean }
  | { type: "PICK_SHOT_POSITION"; position: ShotPosition }
  | { type: "CANCEL" };

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
              event.eventType === "provoked7meter" ||
              event.eventType === "provoked2min" ||
              event.eventType === "travelling" ||
              event.eventType === "dribbleFault" ||
              event.eventType === "forcing" ||
              event.eventType === "lostBall",
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
          // {
          //   target: "startingInterception",
          //   guard: ({ event }) => event.eventType === "interception",
          //   actions: assign(({ context, event }) => {
          //     return {
          //       playerEvent: {
          //         ...context.playerEvent,
          //         eventType: event.eventType,
          //       },
          //     };
          //   }),
          // },
          {
            target: "pickingPlayer",
            guard: ({ event }) =>
              event.eventType === "interception" ||
              event.eventType === "sevenMeterConceded" ||
              event.eventType === "oneOnOneLost" ||
              event.eventType === "blockedShot" ||
              event.eventType === "offensiveFoul",
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
    // startingInterception: {
    //   always: {
    //     target: "pickingPlayer",
    //   },
    // },
    pickingPlayer: {
      on: {
        PICK_PLAYER: [
          {
            target: "finished",
            guard: ({ context }) =>
              context.playerEvent.eventType === "interception" ||
              context.playerEvent.eventType === "sevenMeterConceded" ||
              context.playerEvent.eventType === "oneOnOneLost" ||
              context.playerEvent.eventType === "blockedShot" ||
              context.playerEvent.eventType === "offensiveFoul" ||
              context.playerEvent.eventType === "provoked7meter" ||
              context.playerEvent.eventType === "provoked2min" ||
              context.playerEvent.eventType === "travelling" ||
              context.playerEvent.eventType === "dribbleFault" ||
              context.playerEvent.eventType === "forcing" ||
              context.playerEvent.eventType === "lostBall" ||
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
            const { pick } = event;
            return {
              ...context,
              playerEvent: {
                ...context.playerEvent,
                event: {
                  ...context.playerEvent.event,
                  direction: pick.direction,
                  aim: pick.direction === "OnTarget" ? pick.aim : undefined,
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
