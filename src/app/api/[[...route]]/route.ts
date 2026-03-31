import { handle } from "hono/vercel";
import { apiApp } from "@/server/api/app";

export const GET = handle(apiApp);
export const POST = handle(apiApp);
export const PUT = handle(apiApp);
export const DELETE = handle(apiApp);
