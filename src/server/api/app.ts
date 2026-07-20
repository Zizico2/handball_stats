import { Hono } from "hono";
import { collectionsRoutes } from "@/server/api/routes/collections";
import { e2eRoutes } from "@/server/api/routes/e2e";
import type { ApiEnv } from "@/server/api/types";

export const apiApp = new Hono<ApiEnv>()
  .basePath("/api")
  .route("/collections", collectionsRoutes)
  .route("/e2e", e2eRoutes);

export type ApiApp = typeof apiApp;
