import { handle } from "hono/vercel";
import { apiApp } from "@/server/api/app";

export const GET = handle(apiApp);
