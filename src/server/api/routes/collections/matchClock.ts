import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { clientIdSchema } from "@/datamodel";
import type { ApiEnv } from "@/server/api/types";
import { getMatchClockSnapshot } from "@/server/matchClock";

const paramsSchema = z.object({
  gameId: clientIdSchema,
});

export const matchClockRoutes = new Hono<ApiEnv>().get(
  "/:gameId",
  zValidator("param", paramsSchema),
  async (c) => {
    const { gameId } = c.req.valid("param");
    const { userId } = c.env;

    const snapshot = await getMatchClockSnapshot(userId, gameId, Date.now());

    return c.json(snapshot);
  },
);
