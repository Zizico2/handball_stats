export interface TeamHasGamesConflict {
  code: "TEAM_HAS_GAMES";
  teamIds: number[];
}

export class TeamHasGamesError extends Error {
  readonly teamIds: number[];

  constructor(teamIds: number[], cause?: unknown) {
    super("Team has game history", { cause });
    this.name = "TeamHasGamesError";
    this.teamIds = teamIds;
  }
}

export function classifyTeamHasGamesConflict(
  error: unknown,
): TeamHasGamesConflict | null {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return null;
  }

  if (error.statusCode !== 409 || !("detail" in error)) {
    return null;
  }

  const detail = error.detail;
  if (!detail || typeof detail !== "object" || !("data" in detail)) {
    return null;
  }

  const data = detail.data;
  if (
    !data ||
    typeof data !== "object" ||
    !("code" in data) ||
    data.code !== "TEAM_HAS_GAMES" ||
    !("teamIds" in data)
  ) {
    return null;
  }

  const teamIds = data.teamIds;
  if (
    !Array.isArray(teamIds) ||
    teamIds.length === 0 ||
    !teamIds.every(
      (teamId): teamId is number =>
        typeof teamId === "number" &&
        Number.isSafeInteger(teamId) &&
        teamId > 0,
    )
  ) {
    return null;
  }

  const sortedUniqueTeamIds = [...new Set(teamIds)].toSorted((a, b) => a - b);
  if (
    sortedUniqueTeamIds.length !== teamIds.length ||
    sortedUniqueTeamIds.some((teamId, index) => teamId !== teamIds[index])
  ) {
    return null;
  }

  return { code: "TEAM_HAS_GAMES", teamIds: sortedUniqueTeamIds };
}
