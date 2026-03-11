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

export const shotDirectionSchema = z.enum([
  // "TopLeft",
  // "TopCenter",
  // "TopRight",
  // "MiddleLeft",
  // "MiddleCenter",
  // "MiddleRight",
  // "BottomLeft",
  // "BottomCenter",
  // "BottomRight",
  "OnTarget",
  "OffTarget",
  "Blocked",
]);
export type ShotDirection = z.infer<typeof shotDirectionSchema>;

export const baseShotSchema = z.object({
  goal: z.boolean(),
});

export const shotSchema = baseShotSchema
  .extend({ direction: shotDirectionSchema })
  .refine(({ direction, goal }) => !(direction === "OffTarget" && goal), {
    message: "An off-target shot cannot be a goal",
    path: ["goal"],
  });

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

export const provoked7mEventSchema = withBase(
  z.object({
    eventType: z.literal("provoked7m"),
    eventGroup: z.literal("attack"),
  }),
);
export type Provoked7mEvent = z.infer<typeof provoked7mEventSchema>;

export const provoked2mEventSchema = withBase(
  z.object({
    eventType: z.literal("provoked2m"),
    eventGroup: z.literal("attack"),
  }),
);
export type Provoked2mEvent = z.infer<typeof provoked2mEventSchema>;

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
  provoked7mEventSchema,
  provoked2mEventSchema,
  // defense events
  interceptionEventSchema,
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
