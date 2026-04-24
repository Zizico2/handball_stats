import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getMatchClockSnapshot } from "@/server/matchClock";
import { requireUserId } from "./shared";

const paramsSchema = z.object({
  gameId: z.coerce.number().int().positive(),
});

export const matchClockRoutes = new Hono().get(
  "/:gameId",
  zValidator("param", paramsSchema),
  async (c) => {
    const { gameId } = c.req.valid("param");
    const userId = await requireUserId();

    const snapshot = await getMatchClockSnapshot(userId, gameId, Date.now());

    return c.json(snapshot);
  },
);
