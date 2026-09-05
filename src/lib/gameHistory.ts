import { comparePlayerEventOrder } from "@/components/active-game/utils/playerEventOrder";
import type {
  ActiveGame,
  ClientId,
  Game,
  PlayerEvent,
  Team,
  TeamPlayer,
} from "@/datamodel";
import { PLAYER_EVENTS_CSV_COLUMN_KEYS } from "@/db/playerEventCsv";
import { countGoals } from "@/lib/display/countGoals";

export interface PastGameSummary {
  id: ClientId;
  createdAt: string;
  homeTeamName: string;
  score: number;
  eventCount: number;
}

export interface PastGameLog {
  game: { id: ClientId; createdAt: string; homeTeamName: string };
  players: Array<{ name: string; number: number }>;
  events: PlayerEvent[];
}

interface PastGameSummaryInput {
  games: Game[];
  teams: Team[];
  activeGame?: ActiveGame | null;
  playerEvents: PlayerEvent[];
}

/** Derive the finished-game cards from the collections already in the DB. */
export function buildPastGameSummaries({
  games,
  teams,
  activeGame,
  playerEvents,
}: PastGameSummaryInput): PastGameSummary[] {
  const activeGameId = activeGame?.gameId;
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const eventsByGameId = new Map<ClientId, PlayerEvent[]>();

  for (const event of playerEvents) {
    const events = eventsByGameId.get(event.game_id) ?? [];
    events.push(event);
    eventsByGameId.set(event.game_id, events);
  }

  return games
    .filter((game) => game.id !== activeGameId)
    .flatMap((game) => {
      const homeTeamName = teamNameById.get(game.homeTeamId);
      if (!homeTeamName) return [];

      const events = eventsByGameId.get(game.id) ?? [];
      return [
        {
          id: game.id,
          createdAt: game.createdAt,
          homeTeamName,
          score: countGoals(events),
          eventCount: events.length,
        },
      ];
    })
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
}

interface PastGameLogInput {
  gameId: ClientId;
  games: Game[];
  teams: Team[];
  teamPlayers: TeamPlayer[];
  playerEvents: PlayerEvent[];
}

/** Select one game's detail data from the shared browser collections. */
export function buildPastGameLog({
  gameId,
  games,
  teams,
  teamPlayers,
  playerEvents,
}: PastGameLogInput): PastGameLog | null {
  const game = games.find((item) => item.id === gameId);
  if (!game) return null;

  const homeTeam = teams.find((team) => team.id === game.homeTeamId);
  if (!homeTeam) return null;

  return {
    game: {
      id: game.id,
      createdAt: game.createdAt,
      homeTeamName: homeTeam.name,
    },
    players: teamPlayers
      .filter((player) => player.teamId === game.homeTeamId)
      .map(({ name, number }) => ({ name, number }))
      .toSorted((left, right) => left.number - right.number),
    events: playerEvents
      .filter((event) => event.game_id === game.id)
      .toSorted(comparePlayerEventOrder),
  };
}

type CsvCell = string | number | boolean | null;

export function toCsvCell(value: CsvCell | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function playerEventToCsvRow(event: PlayerEvent): Record<string, CsvCell> {
  const row: Record<string, CsvCell> = {
    player: event.player,
    ellapsedSeconds: event.ellapsed_seconds,
    eventType: event.eventType,
    eventGroup: event.eventGroup,
    half: event.half,
    shotGoal: null,
    shotDirection: null,
    shotAim: null,
    shotPosition: null,
    substitutionPlayerIn: null,
    suspensionServedBy: null,
    suspensionEndedSuspensionId: null,
  };

  if (event.eventType === "shot") {
    row.shotGoal = event.event.goal;
    row.shotDirection = event.event.direction;
    row.shotAim = event.event.aim ?? null;
    row.shotPosition = event.event.position;
  } else if (event.eventType === "substitution") {
    row.substitutionPlayerIn = event.event.playerIn;
  } else if (event.eventType === "twoMinuteSuspension") {
    row.suspensionServedBy = event.event.servedBy;
  } else if (event.eventType === "twoMinuteSuspensionEnded") {
    row.suspensionEndedSuspensionId = event.event.suspensionId;
  }

  return row;
}

/** Serialize domain events using the same column order as the D1 export. */
export function playerEventsToCsv(events: PlayerEvent[]): string {
  const rows = [PLAYER_EVENTS_CSV_COLUMN_KEYS.join(",")];
  for (const event of events) {
    const row = playerEventToCsvRow(event);
    rows.push(
      PLAYER_EVENTS_CSV_COLUMN_KEYS.map((key) => toCsvCell(row[key])).join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}
