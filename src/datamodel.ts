import z from "zod";

export const clientIdSchema = z.uuidv4().brand<"ClientId">();
export type ClientId = z.infer<typeof clientIdSchema>;

export const matchHalfSchema = z.enum(["firstHalf", "secondHalf"]);
export type MatchHalf = z.infer<typeof matchHalfSchema>;

export const shotPosition = z.enum([
  "9m+",
  "6m+",
  "penetration",
  "rightWing",
  "leftWing",
  "pivot",
  "other",
]);

export type ShotPosition = z.infer<typeof shotPosition>;

/** Target sector on the goal (3×3), from the shooter's perspective. */
export const shotAimSchema = z.enum([
  "TopLeft",
  "TopCenter",
  "TopRight",
  "MiddleLeft",
  "MiddleCenter",
  "MiddleRight",
  "BottomLeft",
  "BottomCenter",
  "BottomRight",
]);
export type ShotAim = z.infer<typeof shotAimSchema>;

export const shotDirectionSchema = z.enum([
  "OnTarget",
  "OffTarget",
  "Blocked",
  /** Hit the frame (post or bar)—not split by left/right/top. */
  "Post",
]);
export type ShotDirection = z.infer<typeof shotDirectionSchema>;

function withShotDirectionFields<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
) {
  const extended = schema.extend({
    direction: shotDirectionSchema,
    aim: shotAimSchema.optional(),
  }) as z.ZodObject<
    T & {
      direction: typeof shotDirectionSchema;
      aim: z.ZodOptional<typeof shotAimSchema>;
    }
  >;

  return extended.refine(
    (data) => {
      const { direction, aim } = data as {
        direction: ShotDirection;
        aim?: ShotAim;
      };
      return aim === undefined || direction === "OnTarget";
    },
    {
      message: "Aim may only be recorded for on-target shots",
      path: ["aim"],
    },
  );
}

export const shotDirectionFieldsSchema = withShotDirectionFields(z.object({}));

export type ShotDirectionFields = z.infer<typeof shotDirectionFieldsSchema>;

const baseShotResultSchema = z.object({
  goal: z.boolean(),
});

export const baseShotSchema = baseShotResultSchema.extend({
  position: shotPosition,
});

export const shotResultSchema = withShotDirectionFields(baseShotResultSchema)
  .refine(({ direction, goal }) => !(direction === "OffTarget" && goal), {
    message: "An off-target attempt cannot be a goal",
    path: ["goal"],
  })
  .refine(({ direction, goal }) => !(direction === "Post" && goal), {
    message: "A post attempt cannot be a goal",
    path: ["goal"],
  });
export type ShotResult = z.infer<typeof shotResultSchema>;

export const shotSchema = withShotDirectionFields(baseShotSchema)
  .refine(({ direction, goal }) => !(direction === "OffTarget" && goal), {
    message: "An off-target shot cannot be a goal",
    path: ["goal"],
  })
  .refine(({ direction, goal }) => !(direction === "Post" && goal), {
    message: "A post shot cannot be a goal",
    path: ["goal"],
  });

export type Shot = z.infer<typeof shotSchema>;

export const playerSchema = z.number();
export type Player = z.infer<typeof playerSchema>;

export const basePlayerEventSchema = z.object({
  id: clientIdSchema,
  sequence: z.number().int().positive().nullable().default(null),
  player: playerSchema,
  game_id: clientIdSchema,
  ellapsed_seconds: z.number(),
  half: matchHalfSchema,
});
export type BasePlayerEvent = z.infer<typeof basePlayerEventSchema>;

const basePlayerlessEventSchema = basePlayerEventSchema.omit({ player: true });

export const interceptionEventSchema = withBase(
  z.object({
    eventType: z.literal("interception"),
    eventGroup: z.literal("defense"),
  }),
);
export type InterceptionEvent = z.infer<typeof interceptionEventSchema>;

export const sevenMeterConcededEventSchema = withBase(
  z.object({
    eventType: z.literal("sevenMeterConceded"),
    eventGroup: z.literal("defense"),
  }),
);
export type SevenMeterConcededEvent = z.infer<
  typeof sevenMeterConcededEventSchema
>;

export const oneOnOneLostEventSchema = withBase(
  z.object({
    eventType: z.literal("oneOnOneLost"),
    eventGroup: z.literal("defense"),
  }),
);
export type OneOnOneLostEvent = z.infer<typeof oneOnOneLostEventSchema>;

export const blockedShotEventSchema = withBase(
  z.object({
    eventType: z.literal("blockedShot"),
    eventGroup: z.literal("defense"),
  }),
);
export type BlockedShotEvent = z.infer<typeof blockedShotEventSchema>;

export const defenseOffensiveFoulEventSchema = withBase(
  z.object({
    eventType: z.literal("offensiveFoul"),
    eventGroup: z.literal("defense"),
  }),
);
export type DefenseOffensiveFoulEvent = z.infer<
  typeof defenseOffensiveFoulEventSchema
>;

export const attackOffensiveFoulEventSchema = withBase(
  z.object({
    eventType: z.literal("offensiveFoul"),
    eventGroup: z.literal("attack"),
  }),
);
export type AttackOffensiveFoulEvent = z.infer<
  typeof attackOffensiveFoulEventSchema
>;

/** Kept as an alias for callers that used the original defense-only type. */
export type OffensiveFoulEvent = DefenseOffensiveFoulEvent;

export const provoked7meterEventSchema = withBase(
  z.object({
    eventType: z.literal("provoked7meter"),
    eventGroup: z.literal("attack"),
  }),
);
export type Provoked7meterEvent = z.infer<typeof provoked7meterEventSchema>;

export const provoked2minEventSchema = withBase(
  z.object({
    eventType: z.literal("provoked2min"),
    eventGroup: z.literal("attack"),
  }),
);
export type Provoked2minEvent = z.infer<typeof provoked2minEventSchema>;

export const travellingEventSchema = withBase(
  z.object({
    eventType: z.literal("travelling"),
    eventGroup: z.literal("attack"),
  }),
);
export type TravellingEvent = z.infer<typeof travellingEventSchema>;

export const dribbleFaultEventSchema = withBase(
  z.object({
    eventType: z.literal("dribbleFault"),
    eventGroup: z.literal("attack"),
  }),
);
export type DribbleFaultEvent = z.infer<typeof dribbleFaultEventSchema>;

export const forcingEventSchema = withBase(
  z.object({
    eventType: z.literal("forcing"),
    eventGroup: z.literal("attack"),
  }),
);
export type ForcingEvent = z.infer<typeof forcingEventSchema>;

export const lostBallEventSchema = withBase(
  z.object({
    eventType: z.literal("lostBall"),
    eventGroup: z.literal("attack"),
  }),
);
export type LostBallEvent = z.infer<typeof lostBallEventSchema>;

export const redCardEventSchema = withBase(
  z.object({
    eventType: z.literal("redCard"),
    eventGroup: z.literal("sanction"),
  }),
);
export type RedCardEvent = z.infer<typeof redCardEventSchema>;

export const yellowCardEventSchema = withBase(
  z.object({
    eventType: z.literal("yellowCard"),
    eventGroup: z.literal("sanction"),
  }),
);
export type YellowCardEvent = z.infer<typeof yellowCardEventSchema>;

export const twoMinuteSuspensionEventSchema = withBase(
  z.object({
    eventType: z.literal("twoMinuteSuspension"),
    eventGroup: z.literal("sanction"),
    event: z.object({
      servedBy: playerSchema,
    }),
  }),
);
export type TwoMinuteSuspensionEvent = z.infer<
  typeof twoMinuteSuspensionEventSchema
>;

export const twoMinuteSuspensionEndedEventSchema = withBase(
  z.object({
    eventType: z.literal("twoMinuteSuspensionEnded"),
    eventGroup: z.literal("sanction"),
    event: z.object({
      suspensionId: clientIdSchema,
    }),
  }),
);
export type TwoMinuteSuspensionEndedEvent = z.infer<
  typeof twoMinuteSuspensionEndedEventSchema
>;

export const shotEventSchema = withBase(
  z.object({
    eventType: z.literal("shot"),
    eventGroup: z.literal("attack"),
    event: shotSchema,
  }),
);
export type ShotEvent = z.infer<typeof shotEventSchema>;

export const defenseShotEventSchema = basePlayerlessEventSchema.extend({
  eventType: z.literal("shot"),
  eventGroup: z.literal("defense"),
  event: shotSchema,
});
export type DefenseShotEvent = z.infer<typeof defenseShotEventSchema>;

export const attackSevenMeterTakenEventSchema = withBase(
  z.object({
    eventType: z.literal("sevenMeterTaken"),
    eventGroup: z.literal("attack"),
    event: shotResultSchema,
  }),
);
export type AttackSevenMeterTakenEvent = z.infer<
  typeof attackSevenMeterTakenEventSchema
>;

export const defenseSevenMeterTakenEventSchema =
  basePlayerlessEventSchema.extend({
    eventType: z.literal("sevenMeterTaken"),
    eventGroup: z.literal("defense"),
    event: shotResultSchema,
  });
export type DefenseSevenMeterTakenEvent = z.infer<
  typeof defenseSevenMeterTakenEventSchema
>;

export const substitutionEventSchema = withBase(
  z.object({
    eventType: z.literal("substitution"),
    eventGroup: z.literal("substitution"),
    event: z.object({
      playerIn: playerSchema,
    }),
  }),
);
export type SubstitutionEvent = z.infer<typeof substitutionEventSchema>;

export const startingPlayerEventSchema = withBase(
  z.object({
    eventType: z.literal("startingPlayer"),
    eventGroup: z.literal("substitution"),
  }),
);
export type StartingPlayerEvent = z.infer<typeof startingPlayerEventSchema>;

// `eventType` is not unique across attack and defense (for example, both
// groups have shots), so the union must validate the complete event shape.
export const playerEventSchema = z.union([
  // attack events
  shotEventSchema,
  defenseShotEventSchema,
  attackSevenMeterTakenEventSchema,
  defenseSevenMeterTakenEventSchema,
  attackOffensiveFoulEventSchema,
  provoked7meterEventSchema,
  provoked2minEventSchema,
  travellingEventSchema,
  dribbleFaultEventSchema,
  forcingEventSchema,
  lostBallEventSchema,
  // defense events
  interceptionEventSchema,
  sevenMeterConcededEventSchema,
  oneOnOneLostEventSchema,
  blockedShotEventSchema,
  defenseOffensiveFoulEventSchema,
  // sanction events
  redCardEventSchema,
  yellowCardEventSchema,
  twoMinuteSuspensionEventSchema,
  twoMinuteSuspensionEndedEventSchema,
  // substitution events
  substitutionEventSchema,
  startingPlayerEventSchema,
]);

export type PlayerEvent = z.infer<typeof playerEventSchema>;

export const eventTypeSchema = z.enum([
  "shot",
  "sevenMeterTaken",
  "offensiveFoul",
  "provoked7meter",
  "provoked2min",
  "travelling",
  "dribbleFault",
  "forcing",
  "lostBall",
  "interception",
  "sevenMeterConceded",
  "oneOnOneLost",
  "blockedShot",
  "redCard",
  "yellowCard",
  "twoMinuteSuspension",
  "twoMinuteSuspensionEnded",
  "substitution",
  "startingPlayer",
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventGroupSchema = z.enum([
  "attack",
  "defense",
  "sanction",
  "substitution",
]);
export type EventGroup = z.infer<typeof eventGroupSchema>;

function withBase<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return basePlayerEventSchema.extend(schema.shape);
}

export const teamSchema = z.object({
  id: clientIdSchema,
  name: z.string(),
});
export type Team = z.infer<typeof teamSchema>;

export const teamPlayerSchema = z.object({
  id: clientIdSchema,
  teamId: clientIdSchema,
  name: z.string(),
  number: z.number(),
});
export type TeamPlayer = z.infer<typeof teamPlayerSchema>;

export const quickSubPairSchema = z.object({
  id: clientIdSchema,
  teamId: clientIdSchema,
  playerNumberA: z.number(),
  playerNumberB: z.number(),
});
export type QuickSubPair = z.infer<typeof quickSubPairSchema>;

export const gameSchema = z.object({
  id: clientIdSchema,
  homeTeamId: clientIdSchema,
  createdAt: z.iso.datetime(),
  firstHalfStartedAtMs: z.number().nullable().optional(),
  halftimeStartedAtMs: z.number().nullable().optional(),
  secondHalfStartedAtMs: z.number().nullable().optional(),
});
export type Game = z.infer<typeof gameSchema>;

export const gamePhaseTransitionResultSchema = z.object({
  game: gameSchema,
  /** True only when this request wrote the phase timestamp. */
  applied: z.boolean(),
});
export type GamePhaseTransitionResult = z.infer<
  typeof gamePhaseTransitionResultSchema
>;

export const pauseToggleSchema = z.object({
  id: clientIdSchema,
  gameId: clientIdSchema,
  half: matchHalfSchema,
  // TODO: use z.date() for this.
  toggledAtMs: z.number(),
});
export type PauseToggle = z.infer<typeof pauseToggleSchema>;

export const gamePauseStateBodySchema = z.object({
  half: matchHalfSchema,
  paused: z.boolean(),
  clientId: clientIdSchema.optional(),
});
export type GamePauseStateBody = z.infer<typeof gamePauseStateBodySchema>;

export const gamePauseStateResultSchema = z.object({
  /** True only when this request inserted a pause toggle row. */
  applied: z.boolean(),
  paused: z.boolean(),
  toggleCount: z.number().int().nonnegative(),
  pauseToggle: pauseToggleSchema.nullable(),
});
export type GamePauseStateResult = z.infer<typeof gamePauseStateResultSchema>;

export const matchClockSnapshotSchema = z.object({
  gameId: clientIdSchema,
  serverNowMs: z.number(),
  activeHalf: matchHalfSchema.nullable(),
  activeElapsedSeconds: z.number(),
  firstHalfElapsedSeconds: z.number(),
  secondHalfElapsedSeconds: z.number(),
  firstHalfPaused: z.boolean(),
  secondHalfPaused: z.boolean(),
});
export type MatchClockSnapshot = z.infer<typeof matchClockSnapshotSchema>;

export const activeGameSchema = z.object({
  id: z.literal(1),
  gameId: clientIdSchema,
  homeTeamId: clientIdSchema,
});
export type ActiveGame = z.infer<typeof activeGameSchema>;

export const startGameBodySchema = z.object({
  id: clientIdSchema,
  homeTeamId: clientIdSchema,
  createdAt: z.iso.datetime(),
});
export type StartGameBody = z.infer<typeof startGameBodySchema>;

export const startGameResultSchema = z.object({
  game: gameSchema,
  activeGame: activeGameSchema,
});
export type StartGameResult = z.infer<typeof startGameResultSchema>;
