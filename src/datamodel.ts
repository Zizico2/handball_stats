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
  .extend({ direction: shotDirectionSchema.nullish() })
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
  // event: z.union([shotSchema, z.literal("interception")]),
});
export type BasePlayerEvent = z.infer<typeof basePlayerEventSchema>;

export const interceptionEventSchema = basePlayerEventSchema.extend({
  event: z.literal("interception"),
});
export type InterceptionEvent = z.infer<typeof interceptionEventSchema>;

export const shotEventSchema = basePlayerEventSchema.extend({
  event: shotSchema,
});
export type ShotEvent = z.infer<typeof shotEventSchema>;

export const playerEventSchema = z.union([
  shotEventSchema,
  interceptionEventSchema,
]) satisfies z.Schema<{
  event: unknown;
  player: Player;
}>;
export type PlayerEvent = z.infer<typeof playerEventSchema>;
