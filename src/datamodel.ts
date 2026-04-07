import z from "zod";

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

export const baseShotSchema = z.object({
  goal: z.boolean(),
});

export const shotSchema = baseShotSchema
  .extend({
    direction: shotDirectionSchema,
    aim: shotAimSchema.optional(),
  })
  .refine(({ direction, goal }) => !(direction === "OffTarget" && goal), {
    message: "An off-target shot cannot be a goal",
    path: ["goal"],
  })
  .refine(({ direction, goal }) => !(direction === "Post" && goal), {
    message: "A post shot cannot be a goal",
    path: ["goal"],
  })
  .refine(
    ({ direction, aim }) => aim === undefined || direction === "OnTarget",
    {
      message: "Aim may only be recorded for on-target shots",
      path: ["aim"],
    },
  );

export type Shot = z.infer<typeof shotSchema>;

export const playerSchema = z.number();
export type Player = z.infer<typeof playerSchema>;

export const basePlayerEventSchema = z.object({
  id: z.number(),
  player: playerSchema,
  game_id: z.number(),
  ellapsed_seconds: z.number(),
});
export type BasePlayerEvent = z.infer<typeof basePlayerEventSchema>;

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

export const offensiveFoulEventSchema = withBase(
  z.object({
    eventType: z.literal("offensiveFoul"),
    eventGroup: z.literal("defense"),
  }),
);
export type OffensiveFoulEvent = z.infer<typeof offensiveFoulEventSchema>;

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
  }),
);
export type TwoMinuteSuspensionEvent = z.infer<
  typeof twoMinuteSuspensionEventSchema
>;

export const shotEventSchema = withBase(
  z.object({
    eventType: z.literal("shot"),
    eventGroup: z.literal("attack"),
    event: shotSchema,
  }),
);
export type ShotEvent = z.infer<typeof shotEventSchema>;

export const playerEventSchema = z.discriminatedUnion("eventType", [
  // attack events
  shotEventSchema,
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
  offensiveFoulEventSchema,
  // sanction events
  redCardEventSchema,
  yellowCardEventSchema,
  twoMinuteSuspensionEventSchema,
]);

export type PlayerEvent = z.infer<typeof playerEventSchema>;

export const eventTypeSchema = z.enum(
  playerEventSchema.options.map((option) => option.shape.eventType.value),
);
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventGroupSchema = z.enum(
  playerEventSchema.options.map((option) => option.shape.eventGroup.value),
);
export type EventGroup = z.infer<typeof eventGroupSchema>;

function withBase<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return basePlayerEventSchema.extend(schema.shape);
}

export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
});
export type Team = z.infer<typeof teamSchema>;

export const teamPlayerSchema = z.object({
  id: z.number(),
  teamId: z.number(),
  name: z.string(),
  number: z.number(),
});
export type TeamPlayer = z.infer<typeof teamPlayerSchema>;

export const gameSchema = z.object({
  id: z.number(),
  homeTeamId: z.number(),
  createdAt: z.iso.datetime(),
});
export type Game = z.infer<typeof gameSchema>;

export const activeGameSchema = z.object({
  id: z.literal(1),
  gameId: z.number(),
  homeTeamId: z.number(),
});
export type ActiveGame = z.infer<typeof activeGameSchema>;
