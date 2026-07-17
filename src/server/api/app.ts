import { Hono } from "hono";
import { collectionsRoutes } from "@/server/api/routes/collections";
import { gameImportsRoutes } from "@/server/api/routes/gameImports";
import type { ApiEnv } from "@/server/api/types";

export const apiApp = new Hono<ApiEnv>()
  .basePath("/api")
  .route("/collections", collectionsRoutes)
  .route("/game-imports", gameImportsRoutes);

export type ApiApp = typeof apiApp;
