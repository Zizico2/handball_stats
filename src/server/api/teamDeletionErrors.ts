import { DetailedError } from "hono/client";

export class TeamHasGamesError extends Error {
  constructor(cause?: unknown) {
    super("Team has game history", { cause });
    this.name = "TeamHasGamesError";
  }
}

export function isTeamHasGamesConflict(error: unknown): boolean {
  if (!(error instanceof DetailedError) || error.statusCode !== 409) {
    return false;
  }

  const data = error.detail?.data;
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === "TEAM_HAS_GAMES"
  );
}
