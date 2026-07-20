import { MIN_ROSTER_SIZE } from "@/lib/roster/minRosterSize";

export type HomeHubKind =
  | "loading"
  | "create-team"
  | "add-players"
  | "start-game"
  | "resume-match";

export interface HomeHubState {
  kind: HomeHubKind;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  teamName?: string | null;
  recentGame?: { id: number; homeTeamName: string } | null;
}

interface ResolveHomeHubStateInput {
  teamCount: number;
  /** Player count on the first / primary team when no active game. */
  readyTeamPlayerCount: number;
  hasActiveGame: boolean;
  activeTeamName: string | null;
  recentGame: { id: number; homeTeamName: string } | null;
}

export function resolveHomeHubState(
  input: ResolveHomeHubStateInput,
): HomeHubState {
  const recentGame = input.recentGame;

  if (input.hasActiveGame) {
    return {
      kind: "resume-match",
      title: "Resume your match",
      description: input.activeTeamName
        ? `${input.activeTeamName} is in progress. Jump back into live entry.`
        : "Your match is in progress. Jump back into live entry.",
      ctaLabel: "Resume match",
      ctaHref: "/active-game",
      teamName: input.activeTeamName,
      recentGame,
    };
  }

  if (input.teamCount === 0) {
    return {
      kind: "create-team",
      title: "Create your first team",
      description:
        "Add a team and roster before you can start tracking a match.",
      ctaLabel: "Create team",
      ctaHref: "/create-teams",
      recentGame,
    };
  }

  if (input.readyTeamPlayerCount < MIN_ROSTER_SIZE) {
    return {
      kind: "add-players",
      title: "Add players to your team",
      description: `You need at least ${MIN_ROSTER_SIZE} player${MIN_ROSTER_SIZE === 1 ? "" : "s"} on a roster before starting a game.`,
      ctaLabel: "Add players",
      ctaHref: "/create-teams",
      recentGame,
    };
  }

  return {
    kind: "start-game",
    title: "Start a game",
    description: "Pick a home team and begin live match tracking.",
    ctaLabel: "Start a game",
    ctaHref: "/new-game",
    recentGame,
  };
}
