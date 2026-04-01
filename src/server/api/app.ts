import { Hono } from "hono";
import { collectionsRoutes } from "@/server/api/routes/collections";

export const apiApp = new Hono()
  .basePath("/api")
  .route("/collections", collectionsRoutes);

export type ApiApp = typeof apiApp;
