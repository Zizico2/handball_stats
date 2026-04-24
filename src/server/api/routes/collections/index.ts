import { Hono } from "hono";
import { activeGameRoutes } from "./activeGame";
import { gamesRoutes } from "./games";
import { pauseTogglesRoutes } from "./pauseToggles";
import { playerEventsRoutes } from "./playerEvents";
import { teamPlayersRoutes } from "./teamPlayers";
import { teamsRoutes } from "./teams";

export const collectionsRoutes = new Hono()
  .route("/player-events", playerEventsRoutes)
  .route("/teams", teamsRoutes)
  .route("/team-players", teamPlayersRoutes)
  .route("/games", gamesRoutes)
  .route("/pause-toggles", pauseTogglesRoutes)
  .route("/active-game", activeGameRoutes);
