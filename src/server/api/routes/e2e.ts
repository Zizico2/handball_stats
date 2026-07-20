import { Hono } from "hono";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { resetE2eUserData } from "@/server/resetE2eUserData";

export const e2eRoutes = new Hono<ApiEnv>().post("/reset", async (c) => {
  const token = c.env.E2E_RESET_TOKEN;
  const authorization = c.req.header("Authorization");

  if (!token || authorization !== `Bearer ${token}`) {
    return c.body(null, 404);
  }

  const db = await getDb();
  await resetE2eUserData(db, c.env.userId);
  return c.body(null, 204);
});
