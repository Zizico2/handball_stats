import { ARCAZZI_GAME_V1, ARCAZZI_GAME_V1_HEADERS } from "./csvContract";
import { serializeCsvRows } from "./serializeCsv";

export type SerializableGameEvent = {
  /** Optional explicit CSV sequence; defaults to array index when omitted. */
  sequence?: number;
  player: number;
  half: string;
  ellapsedSeconds: number;
  eventType: string;
  eventGroup: string;
  shotGoal: boolean | null;
  shotDirection: string | null;
  shotAim: string | null;
  shotPosition: string | null;
  substitutionPlayerIn: number | null;
};

export type SerializableGame = {
  matchExternalId: string;
  /** ISO 8601 timestamp. */
  matchStartedAt: string;
  trackedTeamName: string;
  opponentName: string | null;
  roster: Array<{ number: number; name: string }>;
  /** Events in chronological order; sequence is their position. */
  events: SerializableGameEvent[];
};

/**
 * Serializes a game into the shared `arcazzi-game-v1` contract. Used by the
 * history export so export and import cannot diverge.
 */
export function serializeArcazziGameV1(game: SerializableGame): string {
  const blank = "";
  const rows: unknown[][] = [[...ARCAZZI_GAME_V1_HEADERS]];

  rows.push([
    ARCAZZI_GAME_V1,
    "match",
    game.matchExternalId,
    game.matchStartedAt,
    game.trackedTeamName,
    game.opponentName ?? blank,
    blank,
    blank,
    blank,
    blank,
    blank,
    blank,
    blank,
    blank,
    blank,
    blank,
    blank,
    blank,
  ]);

  for (const player of [...game.roster].sort((a, b) => a.number - b.number)) {
    rows.push([
      ARCAZZI_GAME_V1,
      "player",
      blank,
      blank,
      blank,
      blank,
      player.number,
      player.name,
      blank,
      blank,
      blank,
      blank,
      blank,
      blank,
      blank,
      blank,
      blank,
      blank,
    ]);
  }

  game.events.forEach((event, index) => {
    rows.push([
      ARCAZZI_GAME_V1,
      "event",
      game.matchExternalId,
      blank,
      blank,
      blank,
      event.player,
      blank,
      event.sequence ?? index,
      event.half,
      event.ellapsedSeconds,
      event.eventType,
      event.eventGroup,
      event.shotGoal === null ? blank : event.shotGoal,
      event.shotDirection ?? blank,
      event.shotAim ?? blank,
      event.shotPosition ?? blank,
      event.substitutionPlayerIn ?? blank,
    ]);
  });

  return serializeCsvRows(rows);
}
