import { Hono } from "hono";
import { collectionsRoutes } from "@/server/api/routes/collections";
import type { ApiEnv } from "@/server/api/types";

export const apiApp = new Hono<ApiEnv>()
  .basePath("/api")
  .route("/collections", collectionsRoutes);

export type ApiApp = typeof apiApp;
