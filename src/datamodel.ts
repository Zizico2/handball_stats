import z from "zod";

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

// const shotEventTypeSchema = z.literal("shot");
// const interceptionEventTypeSchema = z.literal("interception");
// const eventTypeSchema = z.union([
//   shotEventTypeSchema,
//   interceptionEventTypeSchema,
// ]);

// type EventType = z.infer<typeof eventTypeSchema>;

export const interceptionEventSchema = z.object({
  eventType: z.literal("interception"),
});
export type InterceptionEvent = z.infer<typeof interceptionEventSchema>;

export const shotEventSchema = z.object({
  eventType: z.literal("shot"),
  event: shotSchema,
});
export type ShotEvent = z.infer<typeof shotEventSchema>;

const withBase = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  basePlayerEventSchema.extend(schema.shape);

export const playerEventSchema = z.discriminatedUnion("eventType", [
  withBase(shotEventSchema),
  withBase(interceptionEventSchema),
]);

export type PlayerEvent = z.infer<typeof playerEventSchema>;

export const eventTypeSchema = z.enum(
  playerEventSchema.options.map((option) => option.shape.eventType.value),
);

export type EventType = z.infer<typeof eventTypeSchema>;
